export const STAGING_SUPABASE_PROJECT = 'svdpujbstxiaunoeqlee';

// This test project was created explicitly for assessment release checks.
// Never infer a test destination from a production or retired .env file.
export function requireStagingTarget(projectRef) {
  if (projectRef !== STAGING_SUPABASE_PROJECT) {
    throw new Error(`Set PULSE_STAGING_PROJECT_REF to the approved PULSE Staging project (${STAGING_SUPABASE_PROJECT}). No production fixture writes are allowed.`);
  }
  return { ref: projectRef, url: `https://${projectRef}.supabase.co` };
}

// The legacy smoke test uses JWT keys so their project and role can be checked
// before creating a client or sending a request. Never echo supplied key data.
export function requireStagingJwt(key, role) {
  try {
    const parts = key.split('.');
    const payload = parts.length === 3 ? JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) : null;
    if (payload?.ref === STAGING_SUPABASE_PROJECT && payload.role === role) return;
  } catch { /* Safe error below. The server still verifies JWT signatures. */ }
  throw new Error(`The staging ${role} key must belong to PULSE Staging.`);
}
