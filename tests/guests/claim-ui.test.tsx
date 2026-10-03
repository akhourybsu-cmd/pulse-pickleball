import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  auth: { user: null as null | { id: string; email: string }, loading: false, isAuthenticated: false },
  rpc: vi.fn(), stash: vi.fn(), clear: vi.fn(),
}));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => mocks.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/authRedirect', () => ({ stashPostAuthRedirect: mocks.stash, clearPostAuthRedirect: mocks.clear }));
vi.mock('@/components/Logo', () => ({ Logo: () => <span>PULSE</span> }));
import ClaimGuest from '@/pages/ClaimGuest';
let root: ReactTestRenderer;
let qc: QueryClient;
const invite = { guest_display_name: 'Alex Guest', invited_email: 'alex@example.test', status: 'pending', is_linked: false, expires_at: '2099-01-01T00:00:00Z' };
function Destination() { const location = useLocation(); return <p>{location.pathname + location.search}</p>; }
async function render() {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  await act(async () => { root = create(<QueryClientProvider client={qc}><MemoryRouter initialEntries={['/claim-guest/test-token']}><Routes>
    <Route path="/claim-guest/:token" element={<ClaimGuest />} /><Route path="/auth" element={<Destination />} />
  </Routes></MemoryRouter></QueryClientProvider>); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
}
const visible = () => JSON.stringify(root.toJSON());
beforeEach(() => {
  vi.clearAllMocks(); Object.assign(mocks.auth, { user: null, loading: false, isAuthenticated: false });
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === 'get_claim_invite' ? [invite] : { ok: true, status: 'linked' }, error: null }));
});
afterEach(() => { act(() => root?.unmount()); qc?.clear(); });

it('routes an incomplete MFA session through verification while retaining its guest link', async () => {
  mocks.auth.user = { id: 'player', email: 'alex@example.test' };
  await render();
  expect(visible()).toContain('/auth?redirect=%2Fclaim-guest%2Ftest-token');
  expect(mocks.stash).toHaveBeenCalledWith('/claim-guest/test-token');
  expect(mocks.clear).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it('lets a signed-out guest choose account creation or sign-in without claiming anything', async () => {
  await render();
  expect(visible()).toContain('Create a PULSE account');
  expect(visible()).toContain('I already have an account');
  expect(mocks.rpc).toHaveBeenCalledTimes(1);
});
it('shows the signed-in identity and requires a deliberate claim before linking', async () => {
  Object.assign(mocks.auth, { user: { id: 'player', email: 'other@example.test' }, isAuthenticated: true });
  await render();
  expect(visible()).toContain('other@example.test');
  expect(visible()).toContain('The organizer must');
  expect(mocks.rpc).not.toHaveBeenCalledWith('claim_guest_profile', expect.anything());
  const button = root.root.findAllByType('button').find(b => JSON.stringify(b.children).includes('Link to my account'))!;
  await act(async () => { await button.props.onClick(); });
  expect(mocks.rpc).toHaveBeenCalledWith('claim_guest_profile', { _token: 'test-token' });
  expect(visible()).toContain("You're all set!");
});
it('handles a null claim response without crashing or remaining stuck in a spinner', async () => {
  Object.assign(mocks.auth, { user: { id: 'player', email: 'alex@example.test' }, isAuthenticated: true });
  await render();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
  const button = root.root.findAllByType('button').find(b => JSON.stringify(b.children).includes('Link to my account'))!;
  await act(async () => { await button.props.onClick(); });
  expect(visible()).toContain("Can't open this invite");
  expect(visible()).toContain('Try again');
});
