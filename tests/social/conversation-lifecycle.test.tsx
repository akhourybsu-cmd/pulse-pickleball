import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), read: vi.fn(), channel: vi.fn(), remove: vi.fn(), user: { id: 'alice' } as { id: string } | null }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: mocks.user }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from, channel: mocks.channel, removeChannel: mocks.remove } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { useConversation } from '@/hooks/useDirectMessages';

type Request = { table: string; filters: Record<string, string>; insert?: Record<string, string>; signal?: AbortSignal };
type Result = { data: unknown; error: unknown };
let view: ReactTestRenderer, state: ReturnType<typeof useConversation>;
let conversation = 'chat-a';
let channels: Array<{ incoming?: (payload: unknown) => void; status?: (status: string) => void }>;
function Harness() { state = useConversation(conversation); return null; }
const message = (id = 'hello', chat = conversation, sender = mocks.user?.id) => ({ id, conversation_id: chat, sender_id: sender, content: id, created_at: '2026-10-10T12:00:00Z' });
const result = (request: Request): Result => ({ error: null, data: request.table === 'direct_messages'
  ? request.insert ? { ...message('sent'), ...request.insert } : [message()]
  : request.table === 'conversation_participants'
    ? [{ user_id: mocks.user?.id, is_muted: false, left_at: null }, { user_id: 'friend', is_muted: false, left_at: null }]
    : { id: 'friend', display_name: 'Court friend' } });
const render = async () => { await act(async () => { if (view) view.update(<Harness />); else view = create(<Harness />); }); };

beforeEach(() => {
  view = undefined as unknown as ReactTestRenderer;
  conversation = 'chat-a'; mocks.user = { id: 'alice' }; channels = [];
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.read.mockReset().mockImplementation((request: Request) => Promise.resolve(result(request)));
  mocks.from.mockImplementation((table: string) => {
    const request: Request = { table, filters: {} };
    const q = { select: () => q, order: () => q, limit: () => q, maybeSingle: () => q, single: () => q,
      eq: (key: string, value: string) => { request.filters[key] = value; return q; }, lt: () => q,
      insert: (value: Request['insert']) => { request.insert = value; return q; },
      abortSignal: (signal: AbortSignal) => { request.signal = signal; return q; },
      then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => mocks.read(request).then(resolve, reject) };
    return q;
  });
  mocks.channel.mockImplementation(() => {
    const callbacks: typeof channels[number] = {}; channels.push(callbacks);
    const channel = { on: (_event: string, _filter: unknown, callback: (payload: unknown) => void) => { callbacks.incoming = callback; return channel; },
      subscribe: (callback: (status: string) => void) => { callbacks.status = callback; return channel; } };
    return channel;
  });
});
afterEach(() => { act(() => view?.unmount()); vi.restoreAllMocks(); vi.useRealTimers(); });

it('keeps messages and the subscription when authentication refreshes the same account', async () => {
  await render(); expect(state.messages).toHaveLength(1); expect(state.loading).toBe(false);
  const calls = mocks.read.mock.calls.length;
  mocks.user = { id: 'alice' }; await render();
  expect(mocks.read).toHaveBeenCalledTimes(calls); expect(channels).toHaveLength(1);
  expect(state.participant?.display_name).toBe('Court friend'); expect(state.messages).toHaveLength(1);
});
it('reports failed initial loads and recovers through retry', async () => {
  mocks.read.mockResolvedValueOnce({ data: null, error: new Error('Offline') });
  await render(); expect(state.loading).toBe(false); expect(state.loadError).toBe(true); expect(state.notFound).toBe(false);
  await act(async () => { await state.refetch(); });
  expect(state.loadError).toBe(false); expect(state.messages).toHaveLength(1); expect(state.participant?.id).toBe('friend');
});
it('keeps the loaded conversation visible when a reconnect fails', async () => {
  await render(); mocks.read.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { channels[0].status?.('SUBSCRIBED'); });
  expect(state.loadError).toBe(true); expect(state.loading).toBe(false);
  expect(state.messages).toHaveLength(1); expect(state.participant?.id).toBe('friend');
});
it('bounds a stuck load and ignores its response after timeout', async () => {
  vi.useFakeTimers(); let finish!: (value: Result) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); expect(state.loading).toBe(true);
  await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
  expect(state.loading).toBe(false); expect(state.loadError).toBe(true);
  await act(async () => { finish({ data: [message('late')], error: null }); });
  expect(state.messages).toEqual([]); expect(state.participant).toBeNull();
});
it('ignores an old account response and realtime events for the same conversation', async () => {
  let finish!: (value: Result) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); const oldChannel = channels[0];
  mocks.user = { id: 'bob' }; await render();
  await act(async () => {
    finish({ data: [message('alice-only', 'chat-a', 'alice')], error: null });
    oldChannel.incoming?.({ new: message('old-socket', 'chat-a', 'alice') });
  });
  expect(state.messages.map(row => row.content)).toEqual(['hello']); expect(state.currentUserId).toBe('bob');
  mocks.user = null; await render();
  expect(state.loading).toBe(false); expect(state.messages).toEqual([]); expect(state.participant).toBeNull();
});
it('does not resurrect an earlier visit when navigating A to B to A', async () => {
  let finish!: (value: Result) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(); conversation = 'chat-b'; await render(); conversation = 'chat-a'; await render();
  await act(async () => { finish({ data: [message('stale-first-visit')], error: null }); });
  expect(state.messages.map(row => row.content)).toEqual(['hello']);
});
it('ignores a send acknowledgement after an account switch', async () => {
  await render(); let finish!: (value: Result) => void;
  mocks.read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { await state.sendMessage('Private to Alice'); });
  expect(state.messages.some(row => row._status === 'sending')).toBe(true);
  mocks.user = { id: 'bob' }; await render();
  await act(async () => { finish({ data: message('Private to Alice', 'chat-a', 'alice'), error: null }); });
  expect(state.messages.map(row => row.content)).toEqual(['hello']);
});
it('distinguishes an invalid conversation from a temporary network failure', async () => {
  mocks.read.mockResolvedValueOnce({ data: null, error: { code: '22P02' } });
  await render(); expect(state.notFound).toBe(true); expect(state.loadError).toBe(false); expect(state.loading).toBe(false);
});
