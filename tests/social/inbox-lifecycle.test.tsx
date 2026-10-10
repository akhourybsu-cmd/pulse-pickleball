import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), read: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), channel: vi.fn(), remove: vi.fn(), error: vi.fn(), user: 'player' }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: mocks.user ? { id: mocks.user } : null }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, channel: mocks.channel, removeChannel: mocks.remove } }));
vi.mock('sonner', () => ({ toast: { error: mocks.error, success: vi.fn() } }));
import { DirectMessagesProvider, useDirectMessages } from '@/hooks/useDirectMessages';
import { GroupInboxProvider, useSocialInbox } from '@/hooks/useSocialInbox';
let view: ReactTestRenderer, client: QueryClient, state: ReturnType<typeof useSocialInbox>, dm: ReturnType<typeof useDirectMessages>;
let browserWindow: EventTarget, browserDocument: EventTarget & { visibilityState: string };
type RecordRow = Record<string, unknown>;
let rows: Record<string, RecordRow[]>;
let channels: Array<{ handlers: Array<{ table: string; run: (payload?: unknown) => void }>; status?: (status: string) => void }>;
const dmRow = () => ({ id: 'dm', updated_at: '2026-10-01T12:00:00Z', participant: { user_id: 'friend', display_name: 'Alex' },
  last_message: { content: 'Court 4?', sender_id: 'friend', created_at: '2026-10-01T12:00:00Z' }, unread_count: 2, is_muted: false });
const groupRow = () => ({ id: 'group', name: 'Court crew', updated_at: '2026-10-01T12:00:00Z', icon_url: null, member_count: 8,
  last_message: { content: 'See you at six', created_at: '2026-10-01T12:00:00Z', senderName: 'Sam', senderIsMe: false }, unread_count: 3 });
function Harness() { state = useSocialInbox(); dm = useDirectMessages(); return null; }
function OtherConsumer() { useSocialInbox(); return null; }
const element = () => <QueryClientProvider client={client}><MemoryRouter initialEntries={['/player/social']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><DirectMessagesProvider><GroupInboxProvider><Harness /><OtherConsumer /></GroupInboxProvider></DirectMessagesProvider></MemoryRouter></QueryClientProvider>;
const settle = async (ms = 25) => { await act(async () => { await new Promise(resolve => setTimeout(resolve, ms)); }); };
const mount = async () => { await act(async () => { view = create(element()); }); await settle(); };
beforeEach(() => {
  vi.clearAllMocks(); mocks.user = 'player'; channels = [];
  rows = { social_dm_inbox: [dmRow()], social_group_inbox: [groupRow()] };
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  browserWindow = new EventTarget(); browserDocument = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  vi.stubGlobal('window', browserWindow); vi.stubGlobal('document', browserDocument);
  mocks.read.mockReset().mockImplementation((name: string) => Promise.resolve({ data: rows[name], error: null }));
  mocks.rpc.mockImplementation((name: string) => ({ abortSignal: (signal: AbortSignal) => mocks.read(name, signal, mocks.user) }));
  mocks.update.mockReset().mockResolvedValue({ error: null });
  mocks.from.mockImplementation(() => {
    let patch: RecordRow;
    const builder = { update: (value: RecordRow) => { patch = value; return builder; },
      eq: (column: string, value: string) => { mocks.eq(column, value); return builder; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.update(patch).then(resolve, reject) };
    return builder;
  });
  mocks.channel.mockImplementation(() => {
    const listeners: typeof channels[number] = { handlers: [] }; channels.push(listeners);
    const channel = { on: (_event: string, filter: { table: string }, run: (payload?: unknown) => void) => { listeners.handlers.push({ table: filter.table, run }); return channel; },
      subscribe: (status: (value: string) => void) => { listeners.status = status; status('SUBSCRIBED'); return channel; } };
    return channel;
  });
});
afterEach(() => { act(() => view?.unmount()); client.clear(); vi.unstubAllGlobals(); });
it('shares one summary request and subscription per inbox across all consumers', async () => {
  await mount();
  expect(mocks.rpc.mock.calls.map(call => call[0]).sort()).toEqual(['social_dm_inbox', 'social_group_inbox']);
  expect(channels).toHaveLength(2); expect(state.conversations).toHaveLength(2); expect(dm.totalUnread).toBe(2);
  expect(state.loading).toBe(false); expect(mocks.from).not.toHaveBeenCalled();
});
it('keeps loaded conversations visible through a refresh, a failed request, and retry', async () => {
  await mount();
  const finish: Array<(value: unknown) => void> = [];
  mocks.read.mockImplementation(() => new Promise(resolve => finish.push(resolve)));
  await act(async () => { state.refetch(); }); await settle();
  expect(state.loading).toBe(false); expect(state.refreshing).toBe(true); expect(state.conversations).toHaveLength(2);
  await act(async () => { finish.forEach(resolve => resolve({ data: null, error: new Error('Offline') })); }); await settle();
  expect(state.error).toBe('Offline'); expect(state.conversations).toHaveLength(2);
  rows.social_dm_inbox = [{ ...dmRow(), unread_count: 8 }];
  mocks.read.mockImplementation((name: string) => Promise.resolve({ data: rows[name], error: null }));
  await act(async () => { state.refetch(); }); await settle();
  expect(state.error).toBeNull(); expect(dm.totalUnread).toBe(8);
});
it('coalesces live bursts and refreshes on reconnect and app return without resetting the inbox', async () => {
  await mount();
  for (const channel of channels) for (const handler of channel.handlers)
    for (let i = 0; i < 10; i++) handler.run({ new: { group_id: 'group' }, old: {} });
  await settle(240); expect(mocks.read).toHaveBeenCalledTimes(4);
  channels.forEach(channel => channel.status?.('SUBSCRIBED'));
  await settle(240); expect(mocks.read).toHaveBeenCalledTimes(6);
  browserDocument.visibilityState = 'hidden'; browserDocument.dispatchEvent(new Event('visibilitychange'));
  await settle(240); expect(mocks.read).toHaveBeenCalledTimes(6);
  browserDocument.visibilityState = 'visible'; browserDocument.dispatchEvent(new Event('visibilitychange'));
  browserWindow.dispatchEvent(new Event('online'));
  await settle(240); expect(mocks.read).toHaveBeenCalledTimes(8); expect(state.loading).toBe(false);
  act(() => view.unmount()); expect(mocks.remove).toHaveBeenCalledTimes(2);
  browserWindow.dispatchEvent(new Event('online')); browserDocument.dispatchEvent(new Event('visibilitychange'));
  await settle(240); expect(mocks.read).toHaveBeenCalledTimes(8);
});
it('isolates users and cancels previous-account responses still in flight', async () => {
  const pending: Array<{ signal: AbortSignal; resolve: (value: unknown) => void }> = [];
  mocks.read.mockImplementation((_name: string, signal: AbortSignal) => new Promise(resolve => pending.push({ signal, resolve })));
  await mount(); expect(state.loading).toBe(true);
  mocks.user = 'different-player'; mocks.read.mockImplementation(() => Promise.resolve({ data: [], error: null }));
  await act(async () => { view.update(element()); }); await settle();
  expect(state.conversations).toEqual([]); expect(state.currentUserId).toBe('different-player');
  expect(pending.every(request => request.signal.aborted)).toBe(true);
  await act(async () => { pending.forEach(request => request.resolve({ data: [dmRow()], error: null })); }); await settle();
  expect(state.conversations).toEqual([]); expect(mocks.remove).toHaveBeenCalledTimes(2);
  mocks.user = ''; await act(async () => { view.update(element()); }); expect(state.conversations).toEqual([]);
});
it('updates shared unread/mute/leave state only after a successful membership change', async () => {
  await mount();
  mocks.update.mockImplementation((patch: RecordRow) => {
    rows.social_dm_inbox = patch.left_at ? [] : [{ ...rows.social_dm_inbox[0],
      ...(patch.last_read_at ? { unread_count: 0 } : {}), ...(patch.is_muted !== undefined ? { is_muted: patch.is_muted } : {}) }];
    return Promise.resolve({ error: null });
  });
  await act(async () => { expect(await state.markRead('dm')).toBe(true); }); await settle();
  expect(dm.totalUnread).toBe(0); expect(mocks.eq).toHaveBeenCalledWith('user_id', 'player'); expect(mocks.eq).toHaveBeenCalledWith('conversation_id', 'dm');
  await act(async () => { expect(await state.setMuted('dm', true)).toBe(true); }); await settle();
  expect(state.conversations.find(row => row.id === 'dm')?.isMuted).toBe(true);
  mocks.update.mockRejectedValueOnce(new Error('Network interrupted'));
  await act(async () => { expect(await state.leaveConversation('dm')).toBe(false); });
  expect(state.conversations.some(row => row.id === 'dm')).toBe(true); expect(mocks.error).toHaveBeenCalled();
  await act(async () => { expect(await state.leaveConversation('dm')).toBe(true); }); await settle();
  expect(state.conversations.map(row => row.id)).toEqual(['group']);
});
