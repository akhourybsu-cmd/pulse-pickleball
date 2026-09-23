import { afterEach, describe, expect, it, vi } from 'vitest';
import { completeAuthCallback, hasPendingAuthCallback } from '../src/lib/authCallback';
import { withAuthDeadline } from '../src/lib/authDeadline';
import { isTransientAuthError } from '../src/lib/authErrors';

const base = 'https://pulse.example.test';
function fixture(suffix = '/auth?code=single-use&redirect=%2Fplayer%2Fplay') {
  let url = base + suffix;
  const session = { user: { id: 'callback-player' } };
  const auth = {
    initialize: vi.fn().mockImplementation(async () => {
      const next = new URL(url); next.searchParams.delete('code'); url = next.href;
      return { error: null };
    }),
    getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    setSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
    exchangeCodeForSession: vi.fn().mockRejectedValue(new Error('both auth code and code verifier should be non-empty')),
  };
  const replace = vi.fn((path: string) => { url = base + path; });
  return { auth, replace, run: (ms?: number) => completeAuthCallback(auth as unknown as Parameters<typeof completeAuthCallback>[0], () => url, replace, ms) };
}

afterEach(() => vi.useRealTimers());
describe('sign-in callback ownership', () => {
  it('waits for SDK exchange without submitting the already-consumed code again', async () => {
    const f = fixture();
    await expect(f.run()).resolves.toEqual({ handled: true, entryPath: true });
    expect(f.auth.initialize).toHaveBeenCalledOnce();
    expect(f.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(f.auth.setSession).not.toHaveBeenCalled();
    expect(f.replace).toHaveBeenCalledWith('/auth?redirect=%2Fplayer%2Fplay');
  });
  it('rejects a code opened without its verifier, even with an unrelated stored session', async () => {
    const f = fixture(); f.auth.initialize.mockResolvedValue({ error: null });
    await expect(f.run()).rejects.toThrow('browser where you started');
    expect(f.auth.getSession).not.toHaveBeenCalled();
    expect(f.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(f.replace).toHaveBeenCalledWith('/auth?redirect=%2Fplayer%2Fplay');
  });
  it('rejects failed SDK initialization without falling back to another login', async () => {
    const f = fixture(); f.auth.initialize.mockResolvedValue({ error: new Error('Expired') });
    await expect(f.run()).rejects.toThrow('sign-in link');
    expect(f.auth.getSession).not.toHaveBeenCalled();
  });
  it('requires the exchanged session to exist', async () => {
    const f = fixture(); f.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(f.run()).rejects.toThrow('sign-in link');
  });
  it('still installs explicit email-link tokens through Auth validation', async () => {
    const f = fixture('/?source=email#access_token=fixture-access&refresh_token=fixture-refresh&type=signup&provider_token=fixture-provider');
    await f.run();
    expect(f.auth.setSession).toHaveBeenCalledWith({ access_token: 'fixture-access', refresh_token: 'fixture-refresh' });
    expect(f.auth.initialize).not.toHaveBeenCalled();
    expect(f.replace).toHaveBeenCalledWith('/?source=email');
  });
  it.each(['/?access_token=only-one', '/?refresh_token=only-one', '/?error_code=denied', '/?error_description=expired'])('cleans and rejects invalid callbacks: %s', async path => {
    const f = fixture(path);
    await expect(f.run()).rejects.toThrow('sign-in link');
    expect(f.auth.getSession).not.toHaveBeenCalled();
    expect(f.replace).toHaveBeenCalledWith('/');
  });
  it.each(['/reset-password?code=recovery', '/?type=recovery&code=recovery', '/player/play?code=ordinary-invite', '/#features'])('leaves recovery and ordinary navigation with their existing owners: %s', async path => {
    const f = fixture(path);
    expect(hasPendingAuthCallback(base + path)).toBe(false);
    await expect(f.run()).resolves.toEqual({ handled: false, entryPath: false });
    expect(f.auth.initialize).not.toHaveBeenCalled();
    expect(f.replace).not.toHaveBeenCalled();
  });
  it('finishes waiting and cleans callback credentials if initialization hangs', async () => {
    vi.useFakeTimers();
    const f = fixture(); f.auth.initialize.mockReturnValue(new Promise(() => {}));
    const result = expect(f.run(150)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(150);
    await result;
    expect(f.replace).toHaveBeenCalledWith('/auth?redirect=%2Fplayer%2Fplay');
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('bounded startup requests', () => {
  it('ends a locked auth wait even if its operation ignores the abort signal', async () => {
    vi.useFakeTimers(); let signal: AbortSignal | undefined;
    const result = expect(withAuthDeadline(s => { signal = s; return new Promise(() => {}); }, 100)).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(100); await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(isTransientAuthError(new DOMException('timeout', 'TimeoutError'))).toBe(true);
  });
  it('clears timers on success, rejection, and synchronous failure', async () => {
    vi.useFakeTimers();
    await expect(withAuthDeadline(() => Promise.resolve('ready'))).resolves.toBe('ready');
    await expect(withAuthDeadline(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');
    await expect(withAuthDeadline(() => { throw new Error('storage unavailable'); })).rejects.toThrow('storage unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not turn a late response into success or retry the operation', async () => {
    vi.useFakeTimers(); let finish!: (value: string) => void;
    const request = vi.fn(() => new Promise<string>(resolve => { finish = resolve; }));
    const success = vi.fn();
    const result = withAuthDeadline(request, 100).then(success);
    const rejected = expect(result).rejects.toMatchObject({ name: 'TimeoutError' });
    await vi.advanceTimersByTimeAsync(100); await rejected;
    finish('late'); await Promise.resolve();
    expect(success).not.toHaveBeenCalled(); expect(request).toHaveBeenCalledOnce();
  });
});
