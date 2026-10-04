import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), signOut: vi.fn(), toast: vi.fn(), user: { id: 'a', email: 'fixture@example.test' } as { id: string; email: string } | null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke }, auth: { signOut: mocks.signOut } } }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: mocks.user, loading: false }) }));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
vi.mock('@/components/legal/LegalPageLayout', () => ({ LegalPageLayout: ({ children }: any) => <main>{children}</main> }));
import DeleteAccount from '@/pages/DeleteAccount';
let renderer: ReactTestRenderer;
const deletion = () => renderer.root.findAllByType('button').find(button => button.children.some(child => typeof child === 'string' && child.includes('Permanently delete my account')))!;
function mount() { act(() => { renderer = create(<MemoryRouter><DeleteAccount /></MemoryRouter>); }); }
function confirm() { act(() => renderer.root.findByProps({ 'aria-label': 'Type DELETE to confirm' }).props.onChange({ target: { value: 'DELETE' } })); }
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'a', email: 'fixture@example.test' }; mocks.signOut.mockResolvedValue({ error: null }); });
afterEach(() => { act(() => renderer?.unmount()); });
it('never submits without explicit confirmation, including programmatic duplicate clicks', async () => {
  mount(); expect(deletion().props.disabled).toBe(true);
  await act(async () => { await deletion().props.onClick(); });
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('treats an empty server response as failure and preserves the signed-in account', async () => {
  mocks.invoke.mockResolvedValue({ data: null, error: null }); mount(); confirm();
  await act(async () => { await deletion().props.onClick(); });
  expect(mocks.signOut).not.toHaveBeenCalled(); expect(deletion().props.disabled).toBe(false);
  expect(mocks.toast).toHaveBeenCalled();
});
it('deduplicates the confirmed deletion request and signs out locally only after server confirmation', async () => {
  let resolve!: (value: unknown) => void;
  mocks.invoke.mockImplementation(() => new Promise(done => resolve = done)); mount(); confirm();
  let pending!: Promise<void>;
  act(() => { const click = deletion().props.onClick; pending = click(); void click(); });
  expect(mocks.invoke).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ data: { ok: true }, error: null }); await pending; });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  expect(JSON.stringify(renderer.toJSON())).toContain('Your account has been deleted');
});
