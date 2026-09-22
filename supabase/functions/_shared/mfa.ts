export interface MfaStatus {
  method: string;
  verified: boolean;
  userId?: string;
  sessionId?: string;
  error?: string;
  expiresAt?: string | null;
}
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
export class MfaAccessError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** PostgREST validates this exact caller JWT; the SECURITY DEFINER status RPC
 * checks its live session and factors. Never query status with a service token.
 */
export async function readCallerMfa(req: Request, deps = {
  url: Deno.env.get('SUPABASE_URL') ?? '', key: Deno.env.get('SUPABASE_ANON_KEY') ?? '', fetch,
}): Promise<MfaStatus> {
  const authorization = req.headers.get('authorization');
  if (!authorization?.match(/^Bearer \S+$/i)) throw new MfaAccessError(401, 'sign_in_required');
  let response: Response;
  try {
    response = await deps.fetch(`${deps.url}/rest/v1/rpc/pulse_mfa_status`, {
      method: 'POST', headers: { apikey: deps.key, Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}', signal: AbortSignal.timeout(10_000),
    });
  } catch { throw new MfaAccessError(503, 'verification_unavailable'); }
  if (!response.ok) throw new MfaAccessError(response.status === 401 ? 401 : 503, response.status === 401 ? 'sign_in_required' : 'verification_unavailable');
  let status: MfaStatus;
  try { status = await response.json(); } catch { throw new MfaAccessError(503, 'verification_unavailable'); }
  if (status?.error === 'sign_in_required') throw new MfaAccessError(401, 'sign_in_required');
  if (typeof status?.verified !== 'boolean' || !['none', 'email', 'authenticator', 'sms'].includes(status.method) || typeof status.userId !== 'string' || !status.userId || typeof status.sessionId !== 'string' || !status.sessionId) throw new MfaAccessError(503, 'verification_unavailable');
  return status;
}

export async function requireCallerMfa(req: Request, read = readCallerMfa): Promise<Response | null> {
  try {
    const status = await read(req);
    if (!status.verified) throw new MfaAccessError(403, 'mfa_required');
    return null;
  } catch (error) {
    const failure = error instanceof MfaAccessError ? error : new MfaAccessError(503, 'verification_unavailable');
    return new Response(JSON.stringify({ error: failure.code }), { status: failure.status, headers: cors });
  }
}

export function generateEmailCode(random = crypto.getRandomValues.bind(crypto)): string {
  const words = new Uint32Array(1);
  // Rejection sampling avoids modulo bias; never use Math.random for codes.
  do { random(words); } while (words[0] >= 4_294_000_000);
  return (words[0] % 1_000_000).toString().padStart(6, '0');
}
export async function hashEmailCode(challengeId: string, code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${challengeId}:${code}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
