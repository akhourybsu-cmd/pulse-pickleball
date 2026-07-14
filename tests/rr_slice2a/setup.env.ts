/**
 * Vitest setup file — loads tests/rr_slice2a/.env.test (git-ignored) into
 * process.env before any scenario runs. If the file is absent, nothing is
 * loaded and the suite auto-skips (harness.readEnv returns null). This keeps
 * credentials out of the repo and prevents accidental production targeting.
 */
import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { assertTestProjectAllowed } from "./guard";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, ".env.test") });

// SAFETY GATE — runs before any fixture/auth/migration/test.
//
// When a database is configured (SUPABASE_URL present) the full positive
// allowlist guard must pass: RR_TEST_PROJECT_REF is set, is not production, and
// every configured endpoint (SUPABASE_URL, DATABASE_URL, CLI link, repo
// config.toml) agrees on that exact ref. Any mismatch throws and aborts the
// run. When nothing is configured the suite simply auto-skips (nothing to
// guard) — see harness.readEnv.
if ((process.env.SUPABASE_URL ?? "").trim()) {
  assertTestProjectAllowed();
}
