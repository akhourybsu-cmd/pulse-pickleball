import { createClient } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeAuthCallback } from '../src/lib/authCallback';

afterEach(() => vi.unstubAllGlobals());

function sdkFixture() {
  const location = { href: 'https://pulse.example.test/?code=fixture-code' };
  const replaceState = vi.fn((_state: unknown, _title: string, path: string) => {
    location.href = new URL(path, location.href).href;
  });
  vi.stubGlobal('window', { location, history: { replaceState, state: null }, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  vi.stubGlobal('document', { visibilityState: 'hidden' });
  const storageKey = 'test-pkce';
  const stored = new Map<string, string>([[`${storageKey}-code-verifier`, JSON.stringify('fixture-verifier')]]);
  const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); }, removeItem: (key: string) => { stored.delete(key); } };
  const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(init?.body as string);
    if (!body.auth_code || !body.code_verifier) return new Response(JSON.stringify({ message: 'both auth code and code verifier should be non-empty' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ access_token: 'fixture-access', refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user: { id: 'fixture-player' } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient('https://fixture-project.supabase.co', 'fixture-public-key', {
    auth: { flowType: 'pkce', storage, storageKey, autoRefreshToken: false, detectSessionInUrl: true, lock: async (_name, _timeout, fn) => fn() },
    global: { fetch: fetcher },
  });
  return { client, location, fetcher, replaceState };
}

describe('actual Supabase SDK callback regression', () => {
  it('reproduces the reported message when application code repeats the SDK exchange', async () => {
    const f = sdkFixture();
    expect((await f.client.auth.initialize()).error).toBeNull();
    expect((await f.client.auth.getSession()).data.session?.user.id).toBe('fixture-player');
    const repeated = await f.client.auth.exchangeCodeForSession('fixture-code');
    expect(repeated.error?.message).toBe('both auth code and code verifier should be non-empty');
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps the successful login and sends exactly one exchange with the fix', async () => {
    const f = sdkFixture();
    const result = await completeAuthCallback(f.client.auth, () => f.location.href, path => f.replaceState(null, '', path));
    expect(result).toEqual({ handled: true, entryPath: true });
    expect(f.fetcher).toHaveBeenCalledOnce();
    expect((await f.client.auth.getSession()).data.session?.user.id).toBe('fixture-player');
    expect(f.location.href).toBe('https://pulse.example.test/');
  });
});
