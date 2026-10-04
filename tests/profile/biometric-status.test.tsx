import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn(), profile: vi.fn(), devices: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: mocks.from } }));
vi.mock('@/hooks/useAuthState', () => ({ useAuthState: () => ({ user: { id: 'a' } }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
import { BiometricSetup } from '@/components/auth/BiometricSetup';
let renderer: ReactTestRenderer;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', { PublicKeyCredential: class {} });
  vi.stubGlobal('navigator', { credentials: {} });
  mocks.profile.mockResolvedValue({ data: { biometric_enabled: true }, error: null });
  mocks.devices.mockResolvedValue({ data: [{ id: 'device', credential_id: 'fixture', device_name: 'Test device', created_at: '2026-10-01', last_used_at: null }], error: null });
  mocks.from.mockImplementation((table: string) => {
    const result = () => table === 'profiles' ? mocks.profile() : mocks.devices();
    const b: any = { select: () => b, eq: () => b, order: () => b, abortSignal: () => b, single: () => b,
      then: (resolve: any, reject: any) => result().then(resolve, reject) };
    return b;
  });
});
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });
async function mount() { await act(async () => { renderer = create(<BiometricSetup />); }); }
const text = () => JSON.stringify(renderer.toJSON());
it('does not claim biometric sign-in is enabled merely because a credential exists', async () => {
  mocks.profile.mockResolvedValueOnce({ data: { biometric_enabled: false }, error: null });
  await mount(); expect(text()).not.toContain('Biometric login enabled'); expect(text()).toContain('Enable on This Device');
});
it('requires both enabled account settings and a registered device', async () => {
  await mount(); expect(text()).toContain('Biometric login enabled'); expect(text()).toContain('Test device');
  act(() => renderer.unmount()); mocks.devices.mockResolvedValueOnce({ data: [], error: null });
  await mount(); expect(text()).not.toContain('Biometric login enabled');
});
it('keeps a failed account setting read unknown and recoverable', async () => {
  mocks.profile.mockResolvedValueOnce({ data: null, error: new Error('Offline') });
  await mount(); expect(text()).toContain('Couldn’t load your registered devices'); expect(text()).not.toContain('Enable on This Device');
  await act(async () => { await renderer.root.findAllByType('button').find(b => b.props.children === 'Try again')!.props.onClick(); });
  expect(text()).toContain('Biometric login enabled');
});
