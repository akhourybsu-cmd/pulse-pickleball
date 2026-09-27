import { validateBackend } from "../src/lib/backendPolicy.mjs";
export {
  PRODUCTION_SUPABASE_PROJECT,
  PRODUCTION_SUPABASE_URL,
  STAGING_SUPABASE_PROJECT,
} from "../src/lib/backendPolicy.mjs";
export const validateProductionSupabase = (env) =>
  validateBackend(env, "production");
export const validateStagingSupabase = (env) => validateBackend(env, "staging");
