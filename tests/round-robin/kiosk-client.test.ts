import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
async function client() {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'public-test-key');
  return (await import('@/integrations/supabase/kioskClient')).kioskClient;
}
describe('session-independent kiosk client', () => {
  it('uses only the public key, never attempts user authentication', async () => {
    const fetch = vi.fn(async () => new Response('[]', { status:200, headers:{'Content-Type':'application/json'} }));
    vi.stubGlobal('fetch',fetch);
    const c = await client();
    const result=await c.from('round_robin_events').select('id');
    expect(result.error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url,init] = fetch.mock.calls[0] as unknown as [string,RequestInit];
    expect(url).toContain('/rest/v1/round_robin_events');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer public-test-key');
    expect(() => c.auth.getSession).toThrow('accessToken');
  });
  it('times out a hung data request so the kiosk can retry', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch',vi.fn((_url: string,init: RequestInit) => new Promise((_resolve,reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Timed out','AbortError')), { once:true });
    })));
    const c=await client();
    const result=Promise.resolve(c.from('round_robin_events').select('id'));
    await vi.advanceTimersByTimeAsync(20_001);
    expect((await result).error?.message).toContain('AbortError');
  });
});
