// Shared by the browser, Vite, and deployment checks. Changing PULSE's backend
// is an explicit migration, never a fallback inferred from an environment file.
export const PRODUCTION_SUPABASE_PROJECT = "rqfqwavhtfwwtmfjnxkx";
export const STAGING_SUPABASE_PROJECT = "svdpujbstxiaunoeqlee";
export const PRODUCTION_SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT}.supabase.co`;

export function validateBackend(env, mode = "production", hostname = "") {
  const staging = mode === "staging";
  const project = staging
    ? STAGING_SUPABASE_PROJECT
    : PRODUCTION_SUPABASE_PROJECT;
  const productionHosts = [
    "pulsepb.com",
    "www.pulsepb.com",
    "pulse-pickleball-c60e1.web.app",
    "pulse-pickleball-c60e1.firebaseapp.com",
  ];
  if (staging && productionHosts.includes(hostname.toLowerCase())) {
    throw new Error(
      "A staging build cannot run on the PULSE production website."
    );
  }
  if (
    env.VITE_SUPABASE_PROJECT_ID !== project ||
    env.VITE_SUPABASE_URL !== `https://${project}.supabase.co`
  ) {
    throw new Error(
      staging
        ? "PULSE staging requires its approved separate test project in .env.staging.local. Production fallback is blocked."
        : `PULSE production must use Supabase project ${project}. Check the build environment.`
    );
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  let valid =
    typeof key === "string" && /^sb_publishable_[A-Za-z0-9_-]{7,}$/.test(key);
  if (!valid && typeof key === "string" && key === key.trim()) {
    try {
      const parts = key.split(".");
      const payload =
        parts.length === 3
          ? JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))
          : null;
      valid = payload?.role === "anon" && payload.ref === project;
    } catch {
      /* Never echo supplied credentials. */
    }
  }
  if (!valid)
    throw new Error(
      "PULSE requires a public client key for the approved Supabase project."
    );
  // Opaque publishable keys cannot prove project ownership here. The release
  // preflight also checks the key against this project's auth settings endpoint.
  return Object.freeze({
    projectId: project,
    url: env.VITE_SUPABASE_URL,
    publishableKey: key,
  });
}
