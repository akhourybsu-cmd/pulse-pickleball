import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), channel: vi.fn(), remove: vi.fn(), read: vi.fn(), change: null as null | (() => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, rpc: mocks.rpc, channel: mocks.channel, removeChannel: mocks.remove } }));
import { useLeaguePosts, type LeaguePost } from '@/hooks/useLeaguePosts';
let client: QueryClient, view: ReactTestRenderer, state: ReturnType<typeof useLeaguePosts>;
let rows: LeaguePost[], browserWindow: EventTarget, browserDocument: EventTarget & { visibilityState: string };
const row = (n: number): LeaguePost => ({ id: `post-${n}`, league_id: 'league', author_id: null, content: `Update ${n}`, pinned: false, version: 1,
  created_at: '2026-10-01T18:00:00Z', updated_at: '2026-10-01T18:00:00Z', edited_at: null });
function Harness({ active, user = 'player' }: { active: boolean; user?: string }) { state = useLeaguePosts('league', user, active); return null; }
const element = (active = true, user = 'player') => <QueryClientProvider client={client}><Harness active={active} user={user} /></QueryClientProvider>;
async function mount(active = true, user = 'player') { await act(async () => { view = create(element(active, user)); }); }
async function settled() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.change = null; rows = [row(1)];
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  browserWindow = new EventTarget(); browserDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', browserWindow); vi.stubGlobal('document', browserDocument);
  mocks.read.mockImplementation((start: number, end: number) => Promise.resolve({ data: rows.slice(start, end + 1), error: null }));
  mocks.from.mockImplementation(() => {
    let start = 0, end = 19;
    const query = { select: () => query, eq: () => query, order: () => query, abortSignal: () => query,
      range: (a: number, b: number) => { start = a; end = b; return query; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.read(start, end).then(resolve, reject) };
    return query;
  });
  mocks.channel.mockImplementation(() => {
    const channel = { on: (_event: string, _filter: unknown, handler: () => void) => { mocks.change = handler; return channel; }, subscribe: () => channel };
    return channel;
  });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
});
afterEach(() => { act(() => view?.unmount()); client.clear(); vi.unstubAllGlobals(); });
it('loads and subscribes only when the Feed tab is opened, then removes listeners on leaving', async () => {
  await mount(false); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.channel).not.toHaveBeenCalled();
  await act(async () => { view.update(element()); }); await settled(); expect(state.posts).toHaveLength(1);
  expect(mocks.channel).toHaveBeenCalledTimes(1);
  await act(async () => { view.update(element(false)); }); expect(mocks.remove).toHaveBeenCalledTimes(1);
  const calls = mocks.read.mock.calls.length;
  browserWindow.dispatchEvent(new Event('online')); browserDocument.dispatchEvent(new Event('visibilitychange')); await settled();
  expect(mocks.read).toHaveBeenCalledTimes(calls);
});
it('refreshes actual query data after live updates, reconnects, and app return', async () => {
  await mount(); await settled(); expect(state.posts[0].content).toBe('Update 1');
  for (const refresh of [() => mocks.change!(), () => browserWindow.dispatchEvent(new Event('online')), () => browserDocument.dispatchEvent(new Event('visibilitychange'))]) {
    rows = [{ ...rows[0], version: rows[0].version + 1, content: `Version ${rows[0].version + 1}` }];
    await act(async () => { refresh(); }); await settled(); expect(state.posts[0].content).toBe(rows[0].content);
  }
});
it('loads older updates without rendering duplicates after a new post shifts the page', async () => {
  rows = Array.from({ length: 25 }, (_, i) => row(i)); await mount(); await settled();
  expect(state.posts).toHaveLength(20); expect(state.hasNextPage).toBe(true);
  rows.unshift(row(100));
  await act(async () => { await state.fetchNextPage(); }); await settled();
  expect(state.posts).toHaveLength(25); expect(new Set(state.posts.map(post => post.id)).size).toBe(25);
  await act(async () => { await state.refetch(); }); await settled();
  expect(state.posts).toHaveLength(26); expect(state.posts[0].id).toBe('post-100'); expect(state.hasNextPage).toBe(false);
});
it('invalidates after a rejected write and sends guarded mutation parameters', async () => {
  await mount(); await settled();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: new Error('This update changed. Refresh the feed.') });
  rows = [{ ...rows[0], version: 2, content: 'Latest version' }];
  await act(async () => { await expect(state.mutate({ type: 'update', post: row(1), content: ' Edit ', pinned: true })).rejects.toThrow('changed'); });
  await settled();
  expect(mocks.rpc).toHaveBeenCalledWith('update_league_post', { p_post_id: 'post-1', p_expected_version: 1, p_content: 'Edit', p_pinned: true });
  expect(state.posts[0].version).toBe(2);
  await act(async () => { await state.mutate({ type: 'create', id: 'new-id', content: ' New announcement ' }); });
  expect(mocks.rpc).toHaveBeenLastCalledWith('create_league_post', { p_league_id: 'league', p_post_id: 'new-id', p_content: 'New announcement' });
  await act(async () => { await state.mutate({ type: 'delete', post: rows[0] }); });
  expect(mocks.rpc).toHaveBeenLastCalledWith('delete_league_post', { p_post_id: 'post-1', p_expected_version: 2 });
});
it('isolates cached feed data when the signed-in user changes', async () => {
  await mount(); await settled(); expect(state.posts).toHaveLength(1);
  rows = [];
  await act(async () => { view.update(element(true, 'outsider')); }); await settled();
  expect(state.posts).toHaveLength(0); expect(mocks.remove).toHaveBeenCalledTimes(1);
});
