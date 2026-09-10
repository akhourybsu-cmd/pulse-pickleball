import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { dayBounds, useVenueDay } from '@/hooks/useVenueDay';
import { fetchProgramAvailability } from '@/lib/venues/programAvailability';
import { fetchVenueCourts, refreshVenueSettings, removeVenueCourt, saveVenueHours, updateVenueCourt } from '@/lib/venues/settings';
import { defaultVenueHours } from '@/lib/venues/hours';
import { fetchUpcomingVenuePrograms, fetchVenueProgram, useVenuePrograms } from '@/hooks/useVenuePrograms';
import { fetchVenueAdminCounts } from '@/lib/venues/adminOverview';
import { listVenueApplications } from '@/lib/venues/venueApplications';
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
    for (const method of ['select', 'eq', 'neq', 'order', 'range', 'lt', 'gt', 'gte', 'or', 'in', 'is', 'limit', 'not', 'update', 'delete']) chain[method] = (...args: unknown[]) => {
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

describe('venue overview and ownership request reads', () => {
  const prepareCounts = () => {
    for (const table of ['venue_courts', 'venue_staff_public', 'group_events', 'group_posts', 'group_members']) state.responses[table] = { count: 3, data: null, error: null };
    state.responses.venues = { data: { email: 'hello@palace.example' }, error: null };
  };
  it('counts all top-level venue programs, excludes internal holds, and separates member statuses', async () => {
    prepareCounts();
    await expect(fetchVenueAdminCounts('venue-one', 'group-one', true)).resolves.toMatchObject({ courts: 3, members: 3, pendingMembers: 3, contactReady: true });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'eq', args: ['venue_id', 'venue-one'] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'is', args: ['parent_event_id', null] });
    expect(state.calls).toContainEqual({ table: 'group_members', method: 'eq', args: ['status', 'active'] });
    expect(state.calls).toContainEqual({ table: 'group_members', method: 'eq', args: ['status', 'pending'] });
    expect(state.calls).not.toContainEqual({ table: 'group_events', method: 'eq', args: ['group_id', 'group-one'] });
  });
  it('does not read pending memberships without community-management authority', async () => {
    prepareCounts(); await expect(fetchVenueAdminCounts('venue-one', 'group-one', false)).resolves.toHaveProperty('pendingMembers', 0);
    expect(state.calls).not.toContainEqual({ table: 'group_members', method: 'eq', args: ['status', 'pending'] });
  });
  it('does not treat missing totals as zero or claim setup is complete on read errors', async () => {
    prepareCounts(); state.responses.group_events.count = null;
    await expect(fetchVenueAdminCounts('venue-one', 'group-one', true)).rejects.toThrow('not confirmed');
    prepareCounts(); state.responses.venues = { data: null, error: { message: 'Access changed' } };
    await expect(fetchVenueAdminCounts('venue-one', 'group-one', true)).rejects.toMatchObject({ message: 'Access changed' });
  });
  it('scopes ownership history to the current venue and applicant', async () => {
    await listVenueApplications('viewer-one', undefined, 0, 'venue-one');
    expect(state.calls).toContainEqual({ table: 'venue_applications', method: 'eq', args: ['applicant_id', 'viewer-one'] });
    expect(state.calls).toContainEqual({ table: 'venue_applications', method: 'eq', args: ['venue_id', 'venue-one'] });
  });
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
  it('separates confirmed counts from the viewer’s waitlist or maybe response', async () => {
    state.responses.group_events = { error: null, data: [{ id: 'program', event_format: 'open_play' }] };
    state.responses.group_event_rsvps = { error: null, data: [
      { event_id: 'program', user_id: 'other', status: 'going' },
      { event_id: 'program', user_id: 'viewer-one', status: 'waitlist' },
    ] };
    const result = await captureDay().queryFn();
    expect(result).toMatchObject({ going: { program: 1 }, viewerRsvpByEvent: { program: 'waitlist' } });
  });
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

describe('venue program details and upcoming sessions', () => {
  it('scopes both caches to the authenticated viewer and selected event', () => {
    renderToStaticMarkup(createElement(() => { useVenuePrograms('venue-one', 'program'); return null; }));
    expect(state.queries.map(query => query.queryKey)).toEqual([
      ['venue-upcoming-programs', 'venue-one', 'viewer-one'], ['venue-program', 'venue-one', 'program', 'viewer-one'],
    ]);
    state.user = null; state.queries = [];
    renderToStaticMarkup(createElement(() => { useVenuePrograms('venue-one', 'program'); return null; }));
    expect(state.queries.every(query => !query.enabled)).toBe(true);
  });
  it('fetches future top-level programs, independent of the selected calendar day', async () => {
    await fetchUpcomingVenuePrograms('venue-one');
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'eq', args: ['venue_id', 'venue-one'] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'is', args: ['parent_event_id', null] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'limit', args: [3] });
    expect(state.calls.some(call => call.method === 'gte' && call.args[0] === 'start_time')).toBe(true);
    expect(state.calls.some(call => call.method === 'lt')).toBe(false);
  });
  it('does not mask a failed upcoming-program read as an empty schedule', async () => {
    state.responses.group_events = { data: null, error: { message: 'Programs unavailable' } };
    await expect(fetchUpcomingVenuePrograms('venue-one')).rejects.toMatchObject({ message: 'Programs unavailable' });
  });
  it('loads current RSVP counts and checks membership in the actual host community', async () => {
    state.responses.group_events = { data: { id: 'program', group_id: 'different-host' }, error: null };
    state.responses.group_members = { data: { status: 'active' }, error: null };
    state.responses.group_event_rsvps = { data: [{ user_id: 'other', status: 'going' }, { user_id: 'viewer-one', status: 'waitlist' }, { user_id: 'unknown', status: 'invalid' }], error: null };
    await expect(fetchVenueProgram('venue-one', 'program', 'viewer-one')).resolves.toMatchObject({ canRsvp: true, event: { user_rsvp: 'waitlist', rsvps: { going: 1, waitlist: 1, maybe: 0 } } });
    expect(state.calls).toContainEqual({ table: 'group_members', method: 'eq', args: ['group_id', 'different-host'] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'eq', args: ['venue_id', 'venue-one'] });
    expect(state.calls).toContainEqual({ table: 'group_events', method: 'eq', args: ['id', 'program'] });
  });
  it.each([null, { status: 'pending' }, { status: 'banned' }])('does not allow registration for non-active membership %s', async membership => {
    state.responses.group_events = { data: { id: 'program', group_id: 'host' }, error: null };
    state.responses.group_members = { data: membership, error: null };
    await expect(fetchVenueProgram('venue-one', 'program', 'viewer-one')).resolves.toMatchObject({ canRsvp: false });
  });
  it.each(['group_events', 'group_members', 'group_event_rsvps'])('fails closed when %s cannot load', async table => {
    state.responses.group_events = { data: { id: 'program', group_id: 'host' }, error: null };
    state.responses[table] = { data: null, error: { message: 'Read failed' } };
    await expect(fetchVenueProgram('venue-one', 'program', 'viewer-one')).rejects.toMatchObject({ message: 'Read failed' });
  });
  it('reports a deleted or inaccessible program', async () => {
    state.responses.group_events = { data: null, error: null };
    await expect(fetchVenueProgram('venue-one', 'program', 'viewer-one')).rejects.toThrow('no longer available');
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
