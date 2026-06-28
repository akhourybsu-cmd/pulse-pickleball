import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GetCredentialsRequest {
  email: string;
}

// ---------------------------------------------------------------------
// Phase 3.B.1 — Email enumeration mitigation.
//
// Two layers, both pure-edge so no schema changes are needed:
//
//   1. Constant-time response. We always wait until at least
//      MIN_RESPONSE_MS has elapsed before returning, so a "no such
//      user" response can't be distinguished from a "user exists, no
//      biometric" response via wall-clock timing.
//
//   2. Per-IP token bucket kept in process memory. Best-effort: it
//      resets on every cold start, so it doesn't stop a determined
//      attacker. It does block the casual case of a logged keystroke
//      scraper, which is what the audit flagged. A production-grade
//      fix would persist the bucket in Postgres — flagged in the
//      Phase 3 report as a follow-up.
// ---------------------------------------------------------------------

const MIN_RESPONSE_MS = 200;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 15;
const rateBucket = new Map<string, number[]>();

function clientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const arr = (rateBucket.get(ip) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RATE_LIMIT_MAX) {
    rateBucket.set(ip, arr);
    return true;
  }
  arr.push(now);
  rateBucket.set(ip, arr);
  return false;
}

async function constantTimeRespond(start: number, body: BodyInit, status = 200) {
  const elapsed = Date.now() - start;
  if (elapsed < MIN_RESPONSE_MS) {
    await new Promise((r) => setTimeout(r, MIN_RESPONSE_MS - elapsed));
  }
  return new Response(body, {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const start = Date.now();
  const ip = clientIp(req);

  // Hard cap. Match the success-shape response so an attacker who hits
  // the cap can't distinguish "blocked" from "no biometric for this
  // email" — they always get { credentials: [], biometric_enabled: false }.
  if (isRateLimited(ip)) {
    console.warn(`[get-biometric-credentials] rate-limit hit ip=${ip}`);
    return constantTimeRespond(
      start,
      JSON.stringify({ credentials: [], biometric_enabled: false }),
    );
  }

  try {
    const { email } = await req.json() as GetCredentialsRequest;

    if (!email) {
      return constantTimeRespond(
        start,
        JSON.stringify({ error: 'Email is required' }),
        400,
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Look up the user's profile by email
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, biometric_enabled')
      .eq('email', email)
      .maybeSingle();

    if (profileError) {
      console.error('Profile lookup error:', profileError);
      return constantTimeRespond(
        start,
        JSON.stringify({ credentials: [], biometric_enabled: false }),
      );
    }

    if (!profile || !profile.biometric_enabled) {
      return constantTimeRespond(
        start,
        JSON.stringify({ credentials: [], biometric_enabled: false }),
      );
    }

    // Fetch credential IDs for this user
    const { data: credentials, error: credError } = await supabaseAdmin
      .from('biometric_credentials')
      .select('credential_id, device_name')
      .eq('user_id', profile.id);

    if (credError) {
      console.error('Credentials lookup error:', credError);
      return constantTimeRespond(
        start,
        JSON.stringify({ credentials: [], biometric_enabled: true }),
      );
    }

    return constantTimeRespond(
      start,
      JSON.stringify({
        credentials: credentials || [],
        biometric_enabled: true,
      }),
    );

  } catch (error) {
    console.error('Error in get-biometric-credentials:', error);
    return constantTimeRespond(
      start,
      JSON.stringify({ error: 'Internal server error' }),
      500,
    );
  }
});
