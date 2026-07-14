/**
 * Allowlist guard for the Slice 2a integration suite.
 *
 * Fail-closed, positive-allowlist safety: the suite may only run against a
 * project the operator has EXPLICITLY named in RR_TEST_PROJECT_REF, and every
 * configured endpoint must agree on that reference. This is deliberately NOT a
 * mere blocklist of the known production ref — an unknown prod project, a typo,
 * or a stale link must also be refused.
 *
 * Runs before fixtures, authentication, migrations, or tests (invoked from
 * setup.env.ts). Throws a clear fatal error on any mismatch. Never prints keys.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const KNOWN_PROD_REF = "ryxklkayezjnwwunuphn";
const FATAL =
  "Refusing to run Slice 2a integration tests: configured database does not match RR_TEST_PROJECT_REF.";

function fail(detail: string): never {
  // detail must never contain secrets — callers pass only refs/hosts/flags.
  throw new Error(`${FATAL}\n  → ${detail}`);
}

function isLocalHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** Extract the Supabase project ref from an API URL, or "local" for a local stack. */
function refFromSupabaseUrl(rawUrl: string): { ref: string; local: boolean; https: boolean; host: string } {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    fail(`SUPABASE_URL is not a valid URL.`);
  }
  const host = u!.hostname;
  const https = u!.protocol === "https:";
  if (isLocalHost(host)) return { ref: "local", local: true, https, host };
  // Cloud: <ref>.supabase.co (or .supabase.in etc.)
  const m = host.match(/^([a-z0-9]{20})\./i);
  if (!m) fail(`SUPABASE_URL host "${host}" does not contain a recognizable project ref.`);
  return { ref: m![1], local: false, https, host };
}

/** The project_id declared in the repo's supabase/config.toml (treated as production). */
function repoDeclaredProjectRef(cwd: string): string | null {
  const p = join(cwd, "supabase", "config.toml");
  if (!existsSync(p)) return null;
  const m = readFileSync(p, "utf8").match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  return m ? m[1] : null;
}

/** The ref the Supabase CLI is currently linked to, if any. */
function cliLinkedRef(cwd: string): string | null {
  const p = join(cwd, "supabase", ".temp", "project-ref");
  if (!existsSync(p)) return null;
  const v = readFileSync(p, "utf8").trim();
  return v || null;
}

export interface GuardResult {
  ref: string;
  local: boolean;
  checkedDatabaseUrl: boolean;
  cliLinkChecked: boolean;
}

/**
 * Assert the configured environment is an allowlisted disposable test project.
 * Returns a redacted summary (no secrets) suitable for logging in a report.
 */
export function assertTestProjectAllowed(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): GuardResult {
  const declaredRef = (env.RR_TEST_PROJECT_REF ?? "").trim();
  const url = (env.SUPABASE_URL ?? "").trim();

  // 1. RR_TEST_PROJECT_REF present.
  if (!declaredRef) fail("RR_TEST_PROJECT_REF is not set (required allowlist).");

  // 2. Not the known production ref.
  if (declaredRef === KNOWN_PROD_REF) fail("RR_TEST_PROJECT_REF is the production project.");

  // 7. Not the ref the repo declares as its (production) project.
  const repoRef = repoDeclaredProjectRef(cwd);
  if (repoRef && declaredRef === repoRef) {
    fail("RR_TEST_PROJECT_REF matches supabase/config.toml project_id (repo production project).");
  }

  if (!url) fail("SUPABASE_URL is not set.");
  const { ref: urlRef, local, https, host } = refFromSupabaseUrl(url);

  // 6. HTTPS unless explicitly local 127.0.0.1.
  if (!local && !https) fail(`SUPABASE_URL must be HTTPS for a remote project (host ${host}).`);

  // 3. SUPABASE_URL resolves to the declared ref (cloud). Local stacks use the
  //    sentinel ref "local" so the URL check is host-based instead.
  if (local) {
    if (declaredRef !== "local") {
      fail(`SUPABASE_URL is a local host but RR_TEST_PROJECT_REF is "${declaredRef}" (use "local").`);
    }
  } else if (urlRef !== declaredRef) {
    fail(`SUPABASE_URL project ref "${urlRef}" != RR_TEST_PROJECT_REF "${declaredRef}".`);
  }

  // 4. DATABASE_URL (if present) resolves to the same project.
  let checkedDatabaseUrl = false;
  const dbUrl = (env.DATABASE_URL ?? "").trim();
  if (dbUrl) {
    checkedDatabaseUrl = true;
    let dbHost = "";
    try {
      dbHost = new URL(dbUrl).hostname;
    } catch {
      fail("DATABASE_URL is not a valid URL.");
    }
    if (local) {
      if (!isLocalHost(dbHost)) fail(`DATABASE_URL host "${dbHost}" is not local but SUPABASE_URL is.`);
    } else if (!dbHost.includes(declaredRef)) {
      fail(`DATABASE_URL host "${dbHost}" does not reference project "${declaredRef}".`);
    }
    // Also reject a DB url that references production outright.
    if (dbHost.includes(KNOWN_PROD_REF)) fail("DATABASE_URL references the production project.");
  }

  // 5. The Supabase CLI linked project matches (cloud only; local needs no link).
  let cliLinkChecked = false;
  if (!local) {
    const linked = cliLinkedRef(cwd);
    if (linked) {
      cliLinkChecked = true;
      if (linked !== declaredRef) {
        fail(`Supabase CLI linked ref "${linked}" != RR_TEST_PROJECT_REF "${declaredRef}". Re-link before running.`);
      }
      if (linked === KNOWN_PROD_REF) fail("Supabase CLI is linked to production.");
    }
    // If not linked, migrations were applied out-of-band; the URL/DB/repo
    // checks above still gate execution. We do not hard-require a link file so
    // a project provisioned purely via the dashboard can still be targeted.
  }

  return { ref: declaredRef, local, checkedDatabaseUrl, cliLinkChecked };
}
