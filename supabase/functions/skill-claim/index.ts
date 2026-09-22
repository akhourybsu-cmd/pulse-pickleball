import { requireCallerMfa } from '../_shared/mfa.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { computeGuestClaim } from '../_shared/skill/claim.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
Deno.serve(async req => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const mfaDenial = await requireCallerMfa(req); if (mfaDenial) return mfaDenial;
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user || user.is_anonymous) return json({ error: 'unauthorized' }, 401);
    // Bound body consumption as well as the parsed response count.
    const reader = req.body?.getReader();
    if (!reader) return json({ error: 'invalid_request' }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 24000) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let body: unknown;
    try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { return json({ error: 'invalid_request' }, 400); }
    const result = computeGuestClaim(body);
    if (!result.ok) return json({ error: result.code }, 422);
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc('import_guest_skill_assessment', {
      p_player_id: user.id, p_attempt_id: result.attemptId, p_responses: result.responses, p_snapshot: result.snapshot,
    });
    if (error) return json({ error: error.code === '42501' || error.code === '23505' ? 'assessment_conflict' : 'save_failed' }, error.code === '42501' || error.code === '23505' ? 409 : 500);
    return json({ authoritative: true, attemptId: result.attemptId, snapshot: data });
  } catch { return json({ error: 'save_failed' }, 500); }
});
