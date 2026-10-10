import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), read: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/components/dashboard/MatchVerificationDialog', () => ({ MatchVerificationDialog: () => null }));
import { ActivityModule } from '@/components/dashboard/ActivityModule';

type Request = { table: string; filters: Record<string, unknown>; columns: string; signal?: AbortSignal };
type Result = { data: unknown[] | null; error: unknown };
let view: ReactTestRenderer, user: string | undefined;
const element = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ActivityModule userId={user} /></MemoryRouter>;
const render = async () => { await act(async () => { if (view) view.update(element()); else view = create(element()); }); };
const content = () => JSON.stringify(view.toJSON());
const approved = (id: string) => ({ match: { id, match_date: '2026-10-10', team1_score: 11, team2_score: 4, updated_at: '2026-10-10T12:00:00Z' }, rating_change: 0.123 });
beforeEach(() => {
  user = 'alice'; view = undefined as unknown as ReactTestRenderer; vi.clearAllMocks();
  mocks.read.mockReset().mockResolvedValue({ data: [], error: null });
  mocks.from.mockImplementation((table: string) => {
    const request: Request = { table, filters: {}, columns: '' };
    const q = { select: (columns: string) => { request.columns = columns; return q; },
      eq: (key: string, value: unknown) => { request.filters[key] = value; return q; },
      gte: () => q, order: () => q, limit: () => q, in: () => q,
      abortSignal: (signal: AbortSignal) => { request.signal = signal; return q; },
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => mocks.read(request).then(resolve, reject) };
    return q;
  });
});
afterEach(() => { act(() => view?.unmount()); vi.useRealTimers(); vi.unstubAllEnvs(); });

it.each(['pending', 'approved', 'upcoming', 'registration', 'event'])('does not claim all caught up when the %s request fails', async failure => {
  mocks.read.mockImplementation((request: Request) => {
    const section = request.table === 'round_robin_events' ? 'event' : request.table === 'match_participants'
      ? request.filters['matches.status'] : request.columns.includes('joined_at') ? 'registration' : 'upcoming';
    return Promise.resolve({ data: section === failure ? null : section === 'upcoming' ? [{ event_id: 'event' }] : [],
      error: section === failure ? new Error('Offline') : null });
  });
  await render(); expect(content()).toContain("Activity couldn't load"); expect(content()).not.toContain('All caught up');
  mocks.read.mockResolvedValue({ data: [], error: null });
  await act(async () => { view.root.findAllByType('button').find(node => node.children.includes('Try again'))!.props.onClick(); });
  expect(content()).toContain('All caught up');
});
it('bounds an unresponsive request and ignores its eventual result', async () => {
  vi.useFakeTimers(); let finish!: (value: Result) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render();
  await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
  expect(content()).toContain("Activity couldn't load");
  await act(async () => { finish({ data: [], error: null }); });
  expect(content()).toContain("Activity couldn't load");
});
it('hides previous account activity immediately and ignores its delayed results', async () => {
  let finish!: (value: Result) => void;
  mocks.read.mockImplementation((request: Request) => request.filters.player_id === 'alice' && request.filters['matches.status'] === 'approved'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: [], error: null }));
  await render(); user = 'bob'; await render(); expect(content()).toContain('All caught up');
  await act(async () => { finish({ data: [approved('alice-private')], error: null }); });
  expect(content()).not.toContain('Match Recorded');
  user = undefined; await render(); expect(view.toJSON()).toBeNull();
});
it('shows event calendar days and readable times without UTC date shifts', async () => {
  vi.stubEnv('TZ', 'America/New_York');
  vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 9, 22, 0));
  mocks.read.mockImplementation((request: Request) => Promise.resolve({ error: null, data:
    request.table === 'round_robin_events' ? [
      { id: 'late', name: 'Evening play', date: '2026-10-09', start_time: '23:00:00' },
      { id: 'morning', name: 'Morning play', date: '2026-10-10', start_time: '09:00:00' },
      { id: 'past', name: 'Already finished', date: '2026-10-09', start_time: '18:00:00' },
    ] : request.table === 'round_robin_players' && request.columns === 'event_id'
      ? ['late', 'morning', 'past'].map(event_id => ({ event_id })) : [] }));
  await render();
  expect(content()).toContain('Today at 11:00 PM'); expect(content()).toContain('Tomorrow at 9:00 AM');
  expect(content()).not.toContain('Already finished');
});
