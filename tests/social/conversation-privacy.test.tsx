import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), read: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
import { useConversationRestriction } from '@/hooks/useConversationRestriction';
let view: ReactTestRenderer, client: QueryClient, state: ReturnType<typeof useConversationRestriction>;
let player = 'alice', friend = 'friend-a';
function Harness() { state = useConversationRestriction(player, friend); return <span>{state.status}:{state.data}</span>; }
const element = () => <QueryClientProvider client={client}><Harness /></QueryClientProvider>;
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); }); };
beforeEach(() => {
  player = 'alice'; friend = 'friend-a'; vi.clearAllMocks();
  client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
  mocks.read.mockReset().mockImplementation((table: string) => Promise.resolve({ data: table === 'user_blocks' ? [] : null, error: null }));
  mocks.from.mockImplementation((table: string) => {
    let participant: string;
    const q = { select: () => q, or: () => q, abortSignal: () => q, maybeSingle: () => q,
      eq: (_column: string, value: string) => { participant = value; return q; },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mocks.read(table, participant).then(resolve, reject) };
    return q;
  });
});
afterEach(() => { act(() => view?.unmount()); client.clear(); });
it('keeps a late privacy response attached to its original chat', async () => {
  let finish!: (value: unknown) => void;
  mocks.read.mockImplementation((table: string, participant: string) => table === 'user_messaging_prefs' && participant === 'friend-a'
    ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: table === 'user_blocks' ? [] : null, error: null }));
  await act(async () => { view = create(element()); }); await settle(); expect(state.isPending).toBe(true);
  friend = 'friend-b'; await act(async () => { view.update(element()); }); await settle();
  expect(state.data).toBeNull();
  await act(async () => { finish({ data: { dm_privacy: 'nobody' }, error: null }); }); await settle();
  expect(state.data).toBeNull(); expect(state.isError).toBe(false);
});
it('does not reuse another account restriction and allows retry after a network failure', async () => {
  mocks.read.mockResolvedValueOnce({ data: [{ blocker_id: 'alice' }], error: null });
  await act(async () => { view = create(element()); }); await settle(); expect(state.data).toContain("You've blocked");
  player = 'bob'; mocks.read.mockRejectedValueOnce(new Error('Offline'));
  await act(async () => { view.update(element()); }); await settle();
  await act(async () => { await vi.waitFor(() => expect(state.isError).toBe(true)); });
  expect(state.data).toBeUndefined();
  await act(async () => { await state.refetch(); }); await settle();
  expect(state.data).toBeNull(); expect(state.isError).toBe(false);
});
