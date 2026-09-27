import { afterEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { getMfaStatus } from '../../src/lib/mfa';
import { isTransientAuthError } from '../../src/lib/authErrors';

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
describe('session verification deadline', () => {
  it('fails closed if verification stalls before its fetch can start', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    rpc.mockReturnValue({ abortSignal: (s: AbortSignal) => { signal = s; return new Promise(() => {}); } });
    const result = expect(getMfaStatus()).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(12_000); await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains the actual server verification status', async () => {
    const status = { userId: 'player', sessionId: 'session', method: 'email', verified: false };
    rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: status, error: null }) });
    await expect(getMfaStatus()).resolves.toEqual(status);
  });
  it.each([0, 429, 503])('identifies an unavailable background check (%s) without granting verification', async status => {
    rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: null, error: { message: 'unavailable' }, status }) });
    await expect(getMfaStatus()).rejects.toSatisfy(isTransientAuthError);
  });
  it.each([401, 403])('does not treat an authorization denial (%s) as a connection problem', async status => {
    rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: null, error: { message: 'denied' }, status }) });
    await expect(getMfaStatus()).rejects.toSatisfy(error => !isTransientAuthError(error));
  });
  it('does not preserve an ended session as a transient failure', async () => {
    rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: { error: 'sign_in_required' }, error: null, status: 200 }) });
    await expect(getMfaStatus()).rejects.toSatisfy(error => !isTransientAuthError(error));
  });
});
