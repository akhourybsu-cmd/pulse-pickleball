export const PRODUCTION_SUPABASE_PROJECT = 'rqfqwavhtfwwtmfjnxkx';
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT}.supabase.co`;

// Fail the build before Firebase or Capacitor can ship a retired backend.
// Never include key values in errors: even a misconfigured server key must
// remain private. This is configuration validation, not JWT verification.
export function validateProductionSupabase(env) {
  if (env.VITE_SUPABASE_PROJECT_ID !== PRODUCTION_SUPABASE_PROJECT ||
      env.VITE_SUPABASE_URL !== PRODUCTION_SUPABASE_URL) {
    throw new Error(`PULSE production must use Supabase project ${PRODUCTION_SUPABASE_PROJECT}. Check the production build environment.`);
  }

  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!key || key.trim() !== key) {
    throw new Error('PULSE production requires a Supabase public client key without surrounding whitespace.');
  }
  if (key.startsWith('sb_publishable_')) return;

  try {
    const parts = key.split('.');
    if (parts.length !== 3) throw new Error('Invalid public key');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.role === 'anon' && payload.ref === PRODUCTION_SUPABASE_PROJECT) return;
  } catch {
    // Report only the expected key type/project, never the supplied key.
  }
  throw new Error('PULSE production requires a publishable key or an anon JWT for the current Supabase project.');
}
