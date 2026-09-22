import { describe, expect, it, vi } from 'vitest';
import { generateEmailCode, hashEmailCode, MfaAccessError, readCallerMfa, requireCallerMfa } from '../../supabase/functions/_shared/mfa';
import { mfaEmailHandler } from '../../supabase/functions/_shared/mfa-handlers';
import { mfaEmail } from '../../supabase/functions/_shared/mfa-email';

const security = { method: 'email', verified: false, userId: 'actual-user', sessionId: 'actual-session' };
const challengeId = '30000000-0000-4000-8000-000000000001';
const request = (body: unknown = {}, authorization = 'Bearer caller-token') => new Request('https://test.invalid/mfa', { method: 'POST', headers: { authorization }, body: JSON.stringify(body) });
const deps = () => ({ read: vi.fn(async () => security), rpc: vi.fn(async () => ({ data: { ok: true, email: 'verified@example.test' }, error: null as unknown })), deliver: vi.fn(async () => {}) });

describe('caller session verification', () => {
  it('validates the exact caller bearer through PostgREST, never a service JWT', async () => {
    const fetcher = vi.fn(async () => Response.json(security));
    await expect(readCallerMfa(request(), { url: 'https://project.test', key: 'public-key', fetch: fetcher })).resolves.toEqual(security);
    expect(fetcher).toHaveBeenCalledWith('https://project.test/rest/v1/rpc/pulse_mfa_status', expect.objectContaining({ headers: { apikey: 'public-key', Authorization: 'Bearer caller-token', 'Content-Type': 'application/json' }, body: '{}', signal: expect.any(AbortSignal) }));
  });
  it.each(['', 'Basic password', 'Bearer two tokens'])('rejects malformed authorization before accessing the database: %s', async authorization => {
    const fetcher = vi.fn();
    await expect(readCallerMfa(request({}, authorization), { url: '', key: '', fetch: fetcher })).rejects.toMatchObject({ status: 401 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([null, {}, { ...security, verified: 'true' }, { ...security, sessionId: null }, { ...security, method: 'unexpected' }])('fails closed on malformed server responses', async result => {
    await expect(readCallerMfa(request(), { url: '', key: '', fetch: async () => Response.json(result) })).rejects.toMatchObject({ status: 503 });
  });
  it('distinguishes expired sessions from unavailable verification', async () => {
    for (const response of [Response.json({ error: 'sign_in_required' }), new Response('', { status: 401 })]) {
      await expect(readCallerMfa(request(), { url: '', key: '', fetch: async () => response })).rejects.toMatchObject({ status: 401 });
    }
    await expect(readCallerMfa(request(), { url: '', key: '', fetch: async () => { throw new Error('timeout'); } })).rejects.toMatchObject({ status: 503 });
  });
  it('denies pending sessions and infrastructure failures; accepts verified sessions', async () => {
    const denied = await requireCallerMfa(request(), async () => security);
    expect(denied?.status).toBe(403); expect(await denied?.json()).toEqual({ error: 'mfa_required' });
    expect((await requireCallerMfa(request(), async () => { throw new Error('offline'); }))?.status).toBe(503);
    expect(await requireCallerMfa(request(), async () => ({ ...security, verified: true }))).toBeNull();
  });
});

describe('production MFA request handlers', () => {
  it('uses only the session identity and database recipient, hashes codes and returns no secrets', async () => {
    const d = deps();
    const response = await mfaEmailHandler('send', d)(request({ email: 'attacker@example.test', userId: 'other', sessionId: 'other' }));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result).toEqual({ success: true, challengeId: expect.any(String) });
    expect(d.rpc).toHaveBeenCalledWith('pulse_issue_mfa_email', expect.objectContaining({ p_user_id: 'actual-user', p_session_id: 'actual-session', p_code_hash: expect.stringMatching(/^[0-9a-f]{64}$/) }));
    const email = d.deliver.mock.calls[0][0];
    expect(email.to).toEqual(['verified@example.test']);
    const code = email.text.match(/\n\n(\d{6})\n\n/)![1];
    expect(d.rpc.mock.calls[0][1].p_code_hash).toBe(await hashEmailCode(result.challengeId, code));
    expect(JSON.stringify(result)).not.toContain(code);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('cancels undeliverable challenges and provides a retry response', async () => {
    const d = deps(); d.deliver.mockRejectedValueOnce(new Error('provider outage'));
    const response = await mfaEmailHandler('send', d)(request());
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'email_unavailable' });
    expect(d.rpc.mock.calls[1]).toEqual(['pulse_cancel_mfa_email', { p_challenge_id: d.rpc.mock.calls[0][1].p_challenge_id }]);
  });
  it('blocks unavailable identity checks before either issuance or verification', async () => {
    for (const action of ['send', 'verify'] as const) {
      const d = deps(); d.read.mockRejectedValueOnce(new MfaAccessError(401, 'sign_in_required'));
      expect((await mfaEmailHandler(action, d)(request())).status).toBe(401);
      expect(d.rpc).not.toHaveBeenCalled(); expect(d.deliver).not.toHaveBeenCalled();
    }
  });
  it('bounds body consumption and rejects invalid structures before service RPCs', async () => {
    for (const body of [null, [], 'text', { purpose: 'sms' }, { pad: 'x'.repeat(1025) }]) {
      const d = deps();
      expect((await mfaEmailHandler('send', d)(request(body))).status).toBe(body && typeof body === 'object' && 'pad' in body ? 413 : 400);
      expect(d.rpc).not.toHaveBeenCalled();
    }
  });
  it('validates six digits and a UUID, then verifies against the current session', async () => {
    const d = deps();
    const handler = mfaEmailHandler('verify', d);
    for (const body of [{ code: '12345', challengeId }, { code: '123456', challengeId: 'bad' }]) expect((await handler(request(body))).status).toBe(400);
    const response = await handler(request({ code: '123456', challengeId, userId: 'other', sessionId: 'other' }));
    expect(await response.json()).toEqual({ success: true });
    expect(d.rpc).toHaveBeenCalledExactlyOnceWith('pulse_verify_mfa_email', { p_user_id: 'actual-user', p_session_id: 'actual-session', p_challenge_id: challengeId, p_code_hash: await hashEmailCode(challengeId, '123456') });
    expect(d.deliver).not.toHaveBeenCalled();
  });
  it.each(['send', 'verify'] as const)('exposes the shared rate limit in %s without falsely reporting success', async action => {
    const d = deps(); d.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'rate_limited' }, error: null });
    const response = await mfaEmailHandler(action, d)(request({ code: '123456', challengeId }));
    expect(response.status).toBe(429); expect(d.deliver).not.toHaveBeenCalled();
  });
});

describe('verification codes and branding', () => {
  it('avoids modulo bias and preserves leading zeros', () => {
    let calls = 0;
    const random = <T extends ArrayBufferView | null>(array: T): T => { (array as Uint32Array)[0] = calls++ === 0 ? 0xffffffff : 42; return array; };
    expect(generateEmailCode(random)).toBe('000042'); expect(calls).toBe(2);
  });
  it('salts the code by challenge and refuses HTML injection in branded messages', async () => {
    expect(await hashEmailCode('one', '123456')).not.toBe(await hashEmailCode('two', '123456'));
    expect(() => mfaEmail('<html>', 'sign_in')).toThrow();
    const email = mfaEmail('123456', 'sign_in');
    expect(email.from).toBe('PULSE <support@pulsepb.com>'); expect(email.html).toContain('PULSE heartbeat logo'); expect(email.text).toContain('10 minutes');
    expect(mfaEmail('123456', 'enroll').text).toContain('turn on email verification');
  });
});
