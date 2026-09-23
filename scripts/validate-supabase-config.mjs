export const PRODUCTION_SUPABASE_PROJECT = 'rqfqwavhtfwwtmfjnxkx';
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT}.supabase.co`;

// Vite falls back to .env when a staging file is absent. Never let that turn a
// test run into production traffic, or accept a server key in a browser build.
export function validateStagingSupabase(env) {
  const project = env.VITE_SUPABASE_PROJECT_ID;
  if (!project || !/^[a-z]{20}$/.test(project) || project === PRODUCTION_SUPABASE_PROJECT ||
      env.VITE_SUPABASE_URL !== `https://${project}.supabase.co`) {
    throw new Error('PULSE staging requires a separate test project in .env.staging.local. Production fallback is blocked.');
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (typeof key === 'string' && key === key.trim()) {
    if (key.startsWith('sb_publishable_') && key.length > 20) return;
    try {
      const parts = key.split('.');
      const payload = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) : null;
      if (payload?.role === 'anon' && payload.ref === project) return;
    } catch { /* Never echo key material. */ }
  }
  throw new Error('PULSE staging requires a public client key for its test project.');
}

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
