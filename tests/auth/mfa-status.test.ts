import { afterEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { getMfaStatus } from '../../src/lib/mfa';

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
});
