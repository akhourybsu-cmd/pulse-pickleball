import { computeAuthoritativeResult } from './complete.ts';

/** The only accepted guest payload is a version, idempotency ID and raw answers. */
export function computeGuestClaim(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false as const, code: 'invalid_request' };
  const b = body as Record<string, unknown>;
  if (typeof b.attemptId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(b.attemptId) ||
    b.assessmentVersion !== 2 || !b.responses || typeof b.responses !== 'object' || Array.isArray(b.responses) ||
    Object.keys(b.responses).length > 64) return { ok: false as const, code: 'invalid_request' };
  const rows = Object.entries(b.responses).map(([item_key, response_key]) => ({ item_key, response_key }));
  if (rows.some(r => typeof r.response_key !== 'string')) return { ok: false as const, code: 'invalid_response' };
  const result = computeAuthoritativeResult({ assessmentVersion: 2, responses: rows as { item_key: string; response_key: string }[] });
  if (!result.ok) return result;
  return { ok: true as const, attemptId: b.attemptId, responses: Object.fromEntries(rows.map(r => [r.item_key, r.response_key])), snapshot: result.snapshot };
}
