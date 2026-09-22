import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildTransactionalMigrationSql, executeSql, findPendingMigrations, readLocalMigrations, unwrapOuterTransaction } from './deploy-supabase-migrations.mjs';
import { requireStagingTarget } from './staging-target.mjs';
import { PRODUCTION_SUPABASE_URL } from './validate-supabase-config.mjs';

const disableJobs = `DO $staging$
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE 'UPDATE cron.job SET active = false WHERE active';
  END IF;
END $staging$;`;

// Keep historical migrations immutable. Bind their environment-specific
// endpoint literals to staging and disable jobs in the SAME transaction as
// their creation, before a scheduler can see committed active jobs.
export function prepareStagingMigration(migration, projectRef) {
  const { url } = requireStagingTarget(projectRef);
  const body = unwrapOuterTransaction(migration.sql).replaceAll(PRODUCTION_SUPABASE_URL, url);
  if (/https?:\/\/[a-z]{20}\.supabase\.co/i.test(body.replaceAll(url, ''))) {
    throw new Error(`Unreviewed external Supabase origin in ${migration.filename}`);
  }
  return buildTransactionalMigrationSql({ ...migration, sql: `${body}\n\n${disableJobs}` });
}

export async function deployStagingMigrations({ accessToken, projectRef, migrationsDirectory, apply = false, fetchImpl = fetch }) {
  requireStagingTarget(projectRef);
  if (!accessToken?.startsWith('sbp_')) throw new Error('A staging-scoped Supabase access token is required.');
  const local = await readLocalMigrations(migrationsDirectory);
  const prepared = new Map(local.map(migration => [migration.version, prepareStagingMigration(migration, projectRef)]));
  const query = (sql, readOnly = true) => executeSql({ accessToken, projectRef, query: sql, readOnly, fetchImpl });
  const history = await query("SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS installed;");
  const remote = history[0]?.installed ? await query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;') : [];
  const pending = findPendingMigrations(local, remote.map(row => row.version));
  console.log(`PULSE Staging: ${pending.length} pending migrations; ${apply ? 'applying' : 'read-only plan'}.`);
  if (!apply) return { pending: pending.map(m => m.filename), applied: [] };
  if (!history[0]?.installed) {
    await query(`BEGIN;
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (version text PRIMARY KEY, statements text[], name text);
      REVOKE ALL ON SCHEMA supabase_migrations FROM PUBLIC, anon, authenticated;
      COMMIT;`, false);
  }
  const applied = [];
  for (const migration of pending) {
    try { await query(prepared.get(migration.version), false); }
    catch (error) { throw new Error(`Staging stopped at ${migration.filename}: ${String(error?.message ?? error).replaceAll(accessToken, '[redacted]')}`); }
    applied.push(migration.version);
    console.log(`Applied ${migration.filename}`);
  }
  return { applied, pending: [] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  deployStagingMigrations({ accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: process.env.PULSE_STAGING_PROJECT_REF, migrationsDirectory: path.join(root, 'supabase/migrations'),
    apply: process.argv.includes('--apply'),
  }).catch(error => { console.error(String(error.message).replaceAll(process.env.SUPABASE_ACCESS_TOKEN || 'NO_TOKEN', '[redacted]')); process.exitCode = 1; });
}
