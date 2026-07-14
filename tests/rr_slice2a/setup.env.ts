/**
 * Vitest setup file — loads tests/rr_slice2a/.env.test (git-ignored) into
 * process.env before any scenario runs. If the file is absent, nothing is
 * loaded and the suite auto-skips (harness.readEnv returns null). This keeps
 * credentials out of the repo and prevents accidental production targeting.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, ".env.test") });

// HARD SAFETY CHECK — refuse to run against the Lovable production backend.
// This fires unconditionally at setup time (before any test collects), so no
// misconfiguration, env ordering, or future edit can route the mutating suite
// at production. Keep this ref in sync with supabase/config.toml project_id.
const PROD_PROJECT_REF = "ryxklkayezjnwwunuphn";
const targetUrl = process.env.SUPABASE_URL ?? "";
if (targetUrl.includes(PROD_PROJECT_REF)) {
  throw new Error(
    `REFUSING TO RUN: SUPABASE_URL points at the production project (${PROD_PROJECT_REF}). ` +
      `The Slice 2a suite mutates data and must only target a disposable/local project.`,
  );
}
