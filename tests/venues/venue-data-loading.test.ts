import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { dayBounds, useVenueDay } from '@/hooks/useVenueDay';
import { fetchProgramAvailability } from '@/lib/venues/programAvailability';
import { fetchVenueCourts, refreshVenueSettings, removeVenueCourt, saveVenueHours, updateVenueCourt } from '@/lib/venues/settings';
import { defaultVenueHours } from '@/lib/venues/hours';
import type { QueryClient } from '@tanstack/react-query';

type Query = { queryKey: unknown[]; enabled: boolean; queryFn: () => Promise<unknown> };
type Result = { data: unknown; error: null | { message: string }; count?: number | null };
const state = vi.hoisted(() => ({
  user: { id: 'viewer-one' } as { id: string } | null,
  queries: [] as Query[],
  responses: {} as Record<string, Result>,
  calls: [] as { table: string; method: string; args: unknown[] }[],
}));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: state.user, loading: false }) }));
vi.mock('@tanstack/react-query', () => ({
  useQuery: (query: Query) => { state.queries.push(query); return { data: undefined, isLoading: true, isPending: true, isError: false, refetch: vi.fn() }; },
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  // getUser is deliberately absent: reading cached membership must not trigger
  // a redundant authentication network request on every venue navigation.
  from: (table: string) => {
    const result = () => state.responses[table] ?? { data: [], error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'lt', 'gt', 'gte', 'or', 'in', 'not', 'update', 'delete']) chain[method] = (...args: unknown[]) => {
      state.calls.push({ table, method, args }); return chain;
    };
    chain.single = chain.maybeSingle = () => Promise.resolve(result());
    chain.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return chain;
  },
  rpc: (...args: unknown[]) => { state.calls.push({ table: 'rpc', method: 'rpc', args }); return Promise.resolve(state.responses.holds ?? { data: [], error: null }); },
} }));

function captureGroup() {
  renderToStaticMarkup(createElement(() => { useGroupDetail('group-one'); return null; }));
  return state.queries.at(-1)!;
}
const day = new Date(2026, 8, 14);
function captureDay() {
  renderToStaticMarkup(createElement(() => { useVenueDay('venue-one', 'group-one', day); return null; }));
  return state.queries.at(-1)!;
}
beforeEach(() => {
  state.user = { id: 'viewer-one' };
  state.queries = [];
  state.calls = [];
  state.responses = {};
});

describe('venue membership loading', () => {
  it('scopes membership caches to the signed-in viewer', () => {
    expect(captureGroup().queryKey).toEqual(['group-detail', 'group-one', 'viewer-one']);
    state.user = { id: 'viewer-two' };
    expect(captureGroup().queryKey).toEqual(['group-detail', 'group-one', 'viewer-two']);
  });
  it('waits for an authenticated viewer', () => {
    state.user = null;
    expect(captureGroup().enabled).toBe(false);
  });
  it('preserves legitimate non-membership without a redundant auth request', async () => {
    state.responses.groups = { data: { id: 'group-one', venues: { id: 'venue-one' } }, error: null };
    state.responses.group_members = { data: null, error: null };
    await expect(captureGroup().queryFn()).resolves.toMatchObject({ group: { venue: { id: 'venue-one' } }, membership: null });
  });
  it('does not present a membership error as missing permissions', async () => {
    state.responses.group_members = { data: null, error: { message: 'Membership unavailable' } };
    await expect(captureGroup().queryFn()).rejects.toMatchObject({ message: 'Membership unavailable' });
  });
});

describe('shared player and operations calendar loading', () => {
  it('marks checkout holds separately from confirmed reservations', async () => {
    state.responses.holds = { data: [{ id: 'hold:pending-order', venue_court_id: 'court-1', event_format: 'reservation' }], error: null };
    const result = await captureDay().queryFn() as { holds: { event_format: string }[]; sessions: unknown[] };
    expect(result.holds[0].event_format).toBe('checkout_hold');
    expect(result.sessions).toEqual([]);
  });
  it('checks recurring programs one occurrence at a time within the hold RPC limit', async () => {
    const windows = [14, 21, 28].map(date => ({ start: new Date(2026, 8, date, 18), end: new Date(2026, 8, date, 20) }));
    state.responses.holds = { data: [{ venue_court_id: 'court-1', start_time: windows[1].start.toISOString(), end_time: windows[1].end.toISOString() }], error: null };
    const occupancy = await fetchProgramAvailability('venue-one', windows);
    const reads = state.calls.filter(call => call.table === 'rpc');
    expect(reads).toHaveLength(3);
    for (const [index, read] of reads.entries()) expect(read.args).toEqual(['venue_checkout_holds', { p_venue: 'venue-one', p_from: windows[index].start.toISOString(), p_to: windows[index].end.toISOString() }]);
    expect(occupancy.some(row => row.venue_court_id === 'court-1')).toBe(true);
  });
  it('fails closed if temporary payment holds cannot be checked during event creation', async () => {
    state.responses.holds = { data: null, error: { message: 'Holds unavailable' } };
    await expect(fetchProgramAvailability('venue-one', [{ start: new Date(2026, 8, 14, 18), end: new Date(2026, 8, 14, 20) }])).rejects.toMatchObject({ message: 'Holds unavailable' });
  });
  it('scopes calendars to the viewer and includes overlap filters', async () => {
    const query = captureDay();
    expect(query.queryKey.at(-1)).toBe('viewer-one');
    await query.queryFn();
    const { from, to } = dayBounds(day);
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'lt', args: ['start_time', to] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'or', args: [`end_time.gt.${from},and(end_time.is.null,start_time.gte.${from})`] });
    expect(state.calls.filter(call => call.table === 'group_events' && call.method === 'gte')).toEqual([]);
  });
  it('labels each internal court allocation with the actual program name', async () => {
    state.responses.group_events = { error: null, data: [
      { id: 'program', title: 'Evening open play', description: 'All levels welcome', event_format: 'open_play' },
      { id: 'hold', parent_event_id: 'program', title: 'Internal allocation', description: null, event_format: 'program_hold' },
    ] };
    const result = await captureDay().queryFn() as { sessions: { id: string; title: string; parent_event_id?: string }[] };
    expect(result.sessions[1]).toMatchObject({ id: 'hold', title: 'Evening open play', parent_event_id: 'program' });
  });
  it.each(['venue_courts', 'group_events', 'holds', 'group_event_rsvps'])('does not report empty availability when %s fails', async (table) => {
    state.responses.group_events = { error: null, data: [{ id: 'program', title: 'Open play', event_format: 'open_play' }] };
    state.responses[table] = { data: null, error: { message: `${table} unavailable` } };
    await expect(captureDay().queryFn()).rejects.toMatchObject({ message: `${table} unavailable` });
  });
});

describe('venue settings persistence', () => {
  it('does not turn a court load failure into an empty editable list', async () => {
    state.responses.venue_courts = { data: null, error: { message: 'Network unavailable' } };
    await expect(fetchVenueCourts('venue-one')).rejects.toMatchObject({ message: 'Network unavailable' });
  });
  it('rejects an hours update that changed no rows', async () => {
    state.responses.venues = { data: null, error: null };
    await expect(saveVenueHours('venue-one', defaultVenueHours())).rejects.toThrow('Nothing was changed');
  });
  it('validates hours before writing anything', async () => {
    const hours = defaultVenueHours(); hours.days[0] = { openMinutes: 1000, closeMinutes: 900 };
    await expect(saveVenueHours('venue-one', hours)).rejects.toThrow('Sun');
    expect(state.calls).toEqual([]);
  });
  it('persists a valid hours update and checks its affected row', async () => {
    state.responses.venues = { data: { id: 'venue-one' }, error: null };
    await expect(saveVenueHours('venue-one', defaultVenueHours())).resolves.toBeUndefined();
    expect(state.calls).toContainEqual({ table: 'venues', method: 'select', args: ['id'] });
  });
  it('scopes court changes to their venue and checks permission/no-row failures', async () => {
    state.responses.venue_courts = { data: null, error: null };
    await expect(updateVenueCourt('venue-one', 'court-1', { is_active: false })).rejects.toThrow('Nothing was changed');
    expect(state.calls).toContainEqual({ table: 'venue_courts', method: 'eq', args: ['venue_id', 'venue-one'] });
    expect(state.calls).toContainEqual({ table: 'venue_courts', method: 'eq', args: ['id', 'court-1'] });
  });
  it('supports editing court details without replacing the court', async () => {
    state.responses.venue_courts = { data: { id: 'court-1' }, error: null };
    await updateVenueCourt('venue-one', 'court-1', { name: 'Championship court', surface_type: 'Cushioned' });
    expect(state.calls).toContainEqual({ table: 'venue_courts', method: 'update', args: [{ name: 'Championship court', surface_type: 'Cushioned' }] });
  });
  it.each([1, 20, null])('does not delete a court when booking-history count is %s', async count => {
    state.responses.group_events = { data: null, count, error: null };
    await expect(removeVenueCourt('venue-one', 'court-1')).rejects.toThrow();
    expect(state.calls.some(call => call.method === 'delete')).toBe(false);
  });
  it('does not delete a court if history cannot load', async () => {
    state.responses.group_events = { data: null, error: { message: 'History unavailable' } };
    await expect(removeVenueCourt('venue-one', 'court-1')).rejects.toMatchObject({ message: 'History unavailable' });
    expect(state.calls.some(call => call.method === 'delete')).toBe(false);
  });
  it('checks the affected row when removing a court with no history', async () => {
    state.responses.group_events = { data: null, count: 0, error: null };
    state.responses.venue_courts = { data: null, error: null };
    await expect(removeVenueCourt('venue-one', 'court-1')).rejects.toThrow('Nothing was changed');
    state.responses.venue_courts.data = { id: 'court-1' };
    await expect(removeVenueCourt('venue-one', 'court-1')).resolves.toBeUndefined();
  });
  it('refreshes each settings consumer after saving', async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);
    await refreshVenueSettings({ invalidateQueries } as unknown as QueryClient, 'venue-one');
    for (const queryKey of [['venue-day', 'venue-one'], ['venue-courts-settings', 'venue-one'], ['venue-admin-counts', 'venue-one'], ['group-detail']]) {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey });
    }
  });
});
