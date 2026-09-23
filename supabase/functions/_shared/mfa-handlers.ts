import { generateEmailCode, hashEmailCode, MfaAccessError, type MfaStatus } from './mfa.ts';
import { mfaEmail } from './mfa-email.ts';

type Rpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: Record<string, unknown> | null; error: unknown }>;
interface Dependencies {
  read: (req: Request) => Promise<MfaStatus>;
  rpc: Rpc;
  deliver: (email: ReturnType<typeof mfaEmail> & { to: string[] }, challengeId: string) => Promise<void>;
}
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new MfaAccessError(400, 'invalid_request');
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 1024) { await reader.cancel(); throw new MfaAccessError(413, 'request_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
    return body as Record<string, unknown>;
  } catch { throw new MfaAccessError(400, 'invalid_request'); }
}

/** Shared production handlers are dependency-injected to test real request and
 * failure paths without real users, provider keys or sending email. */
export function mfaEmailHandler(action: 'send' | 'verify', deps: Dependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, { headers });
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    try {
      const status = await deps.read(req);
      const body = await readBody(req);
      if (action === 'send') {
        const purpose = body.purpose ?? 'sign_in';
        if (purpose !== 'sign_in' && purpose !== 'enroll') throw new MfaAccessError(400, 'invalid_request');
        const challengeId = crypto.randomUUID();
        const code = generateEmailCode();
        const { data, error } = await deps.rpc('pulse_issue_mfa_email', {
          p_user_id: status.userId, p_session_id: status.sessionId, p_challenge_id: challengeId,
          p_code_hash: await hashEmailCode(challengeId, code), p_purpose: purpose,
        });
        if (error) throw new MfaAccessError(503, 'verification_unavailable');
        if (!data?.ok) throw new MfaAccessError(data?.error === 'rate_limited' ? 429 : 403, String(data?.error ?? 'verification_unavailable'));
        if (typeof data.email !== 'string' || !data.email) throw new MfaAccessError(503, 'email_unavailable');
        try {
          // Never use recipient, user or session fields supplied in the body.
          await deps.deliver({ ...mfaEmail(code, purpose), to: [data.email] }, challengeId);
        } catch {
          await deps.rpc('pulse_cancel_mfa_email', { p_challenge_id: challengeId });
          throw new MfaAccessError(503, 'email_unavailable');
        }
        return json({ success: true, challengeId });
      }
      if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code) || typeof body.challengeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.challengeId)) throw new MfaAccessError(400, 'invalid_code');
      const { data, error } = await deps.rpc('pulse_verify_mfa_email', {
        p_user_id: status.userId, p_session_id: status.sessionId, p_challenge_id: body.challengeId,
        p_code_hash: await hashEmailCode(body.challengeId, body.code),
      });
      if (error) throw new MfaAccessError(503, 'verification_unavailable');
      if (!data?.ok) throw new MfaAccessError(data?.error === 'rate_limited' ? 429 : 400, String(data?.error ?? 'invalid_code'));
      return json({ success: true });
    } catch (error) {
      const failure = error instanceof MfaAccessError ? error : new MfaAccessError(503, 'verification_unavailable');
      return json({ error: failure.code }, failure.status);
    }
  };
}
