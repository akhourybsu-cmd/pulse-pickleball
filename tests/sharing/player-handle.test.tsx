import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), eq: vi.fn(), own: vi.fn() }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'self' } }) }));
vi.mock('@/components/Logo', () => ({ Logo: () => <span>PULSE</span> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc, from: state.from } }));
import PlayerByHandle from '@/pages/PlayerByHandle';
let root: ReactTestRenderer, cache: QueryClient, path: string;
function Location() { path = useLocation().pathname; return null; }
function request(value: unknown) { const result = Promise.resolve(value); return Object.assign(result, { abortSignal: () => result }); }
async function mount(handle: string) {
  cache = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => { root = create(<QueryClientProvider client={cache}><MemoryRouter initialEntries={[`/u/${handle}`]}><Location /><Routes><Route path="/u/:handle" element={<PlayerByHandle />} /><Route path="/profile/:id" element={<p>Profile destination</p>} /></Routes></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.rpc.mockImplementation(() => request({ data: [], error: null }));
  state.own.mockResolvedValue({ data: { id: 'self', handle: 'alex-player' }, error: null });
  state.from.mockImplementation(() => {
    const builder = { select: () => builder, eq: (key: string, value: string) => { state.eq(key, value); return builder; }, abortSignal: () => builder, maybeSingle: state.own };
    return builder;
  });
});
afterEach(() => { act(() => root?.unmount()); cache?.clear(); });
it('opens the owner’s own handle despite friend discovery excluding self', async () => {
  await mount('@Alex-Player');
  expect(path).toBe('/profile/self');
  expect(state.eq).toHaveBeenCalledWith('id', 'self');
  expect(state.rpc).toHaveBeenCalledWith('lookup_player_by_handle', { _handle: 'alex-player' });
});
it('uses the discovery result for another player without reading the viewer’s profile', async () => {
  state.rpc.mockImplementation(() => request({ data: [{ id: 'friend' }], error: null }));
  await mount('avery');
  expect(path).toBe('/profile/friend');
  expect(state.from).not.toHaveBeenCalled();
});
it('does not bypass a blocked or missing player with a broad profile lookup', async () => {
  await mount('blocked-player');
  expect(path).toBe('/u/blocked-player');
  expect(JSON.stringify(root.toJSON())).toContain('Player not found');
  expect(state.eq.mock.calls).toEqual([['id', 'self']]);
});
it('keeps a failed self lookup recoverable on the same shared URL', async () => {
  state.own.mockRejectedValue(new TypeError('Offline'));
  await mount('alex-player');
  expect(path).toBe('/u/alex-player');
  expect(JSON.stringify(root.toJSON())).toContain('Connection interrupted');
  expect(JSON.stringify(root.toJSON())).toContain('Try again');
});
