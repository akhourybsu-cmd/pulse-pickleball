import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { executeSql, readLocalMigrations, unwrapOuterTransaction } from './deploy-supabase-migrations.mjs';

const project = 'rqfqwavhtfwwtmfjnxkx';
const releaseVersions = ['20260922180000', '20260922200000'];
const root = fileURLToPath(new URL('../', import.meta.url));
export const compatibilitySql = `SELECT
  count(*) FILTER (WHERE mfa_method = 'sms')::integer AS unsupported_sms,
  count(*) FILTER (WHERE mfa_method = 'authenticator' AND NOT EXISTS (
    SELECT 1 FROM auth.mfa_factors f WHERE f.user_id = p.id AND f.status = 'verified'
  ))::integer AS missing_authenticator
FROM public.profiles p;`;

export async function checkAssessmentRelease({ accessToken, projectRef, preflight = false, fetchImpl = fetch }) {
  if (projectRef !== project || !accessToken?.startsWith('sbp_')) throw new Error('Expected the existing PULSE production deployment credential and project.');
  const query = (sql, readOnly = true) => executeSql({ accessToken, projectRef, query: sql, readOnly, fetchImpl });
  const compatibility = (await query(compatibilitySql))[0];
  if (!compatibility || compatibility.unsupported_sms !== 0 || compatibility.missing_authenticator !== 0) {
    throw new Error('Existing MFA preferences need account recovery before this release. No settings were changed.');
  }
  console.log('Existing account verification preferences are compatible.');
  if (preflight) {
    const local = await readLocalMigrations(path.join(root, 'supabase/migrations'));
    const history = await query('SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;');
    const applied = new Set(history.map(row => row.version));
    const pending = local.filter(m => !applied.has(m.version));
    const assessmentPending = pending.filter(m => releaseVersions.includes(m.version));
    if (assessmentPending.length && pending.some(m => !releaseVersions.includes(m.version))) throw new Error('Unexpected pending migrations; review the production plan before applying.');
    if (assessmentPending.length) {
      // Rehearse only the reviewed assessment DDL. All changes, role settings and
      // NOTIFY events roll back; never run historical jobs or fixture users here.
      await query([
        'BEGIN;', "SET LOCAL lock_timeout = '5s';", "SET LOCAL statement_timeout = '30s';",
        ...assessmentPending.map(m => unwrapOuterTransaction(m.sql)), 'ROLLBACK;',
      ].join('\n'), false);
      console.log(`Hosted schema rehearsal passed; ${assessmentPending.length} assessment migrations rolled back.`);
    } else console.log('Assessment migrations already recorded.');
    return;
  }
  const rows = await query(await readFile(path.join(root, 'scripts/check-session-mfa-readiness.sql'), 'utf8'));
  // The Management API may return only the final statement's rows, so verify
  // each release invariant in one aggregate query rather than trusting output.
  const [status] = await query(`SELECT
    to_regprocedure('public.pulse_mfa_status()') IS NOT NULL AND
    to_regprocedure('public.import_guest_skill_assessment(uuid,uuid,jsonb,jsonb)') IS NOT NULL AS installed,
    EXISTS (SELECT 1 FROM pg_roles r, unnest(r.rolconfig) setting WHERE r.rolname = 'authenticator'
      AND setting = 'pgrst.db_pre_request=public.pulse_enforce_mfa') AS guarded,
    NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relkind IN ('r','p') AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects') OR (n.nspname='realtime' AND c.relname='messages'))
      AND (NOT c.relrowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='pulse_required_mfa' AND NOT p.polpermissive))) AS policies,
    NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN (VALUES ('anon'),('authenticated')) roles(role_name)
      WHERE n.nspname='public' AND p.proname IN ('pulse_issue_mfa_email','pulse_verify_mfa_email','pulse_cancel_mfa_email','insert_mfa_code','verify_and_use_mfa_code','import_guest_skill_assessment')
      AND has_function_privilege(role_name,p.oid,'EXECUTE')) AS grants_closed;`);
  if (!status || !['installed', 'guarded', 'policies', 'grants_closed'].every(key => status[key] === true)) {
    throw new Error(`Assessment backend readiness failed: ${JSON.stringify(status ?? {})}`);
  }
  if (!rows) throw new Error('Readiness query did not complete.');
  for (const name of ['skill-claim', 'skill-complete', 'send-mfa-code', 'verify-mfa-code']) {
    const response = await fetchImpl(`https://${project}.supabase.co/functions/v1/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    // skill-complete retains its gateway JWT check; other handlers validate
    // the caller themselves and must return the new session-aware error.
    if (response.status !== 401 || (name !== 'skill-complete' && body.error !== 'sign_in_required')) throw new Error(`Deployed ${name} did not pass caller-verification smoke check.`);
  }
  console.log('Assessment database, policy/grant checks and deployed caller-verification smoke checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  checkAssessmentRelease({ accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: process.env.SUPABASE_PROJECT_REF, preflight: process.argv.includes('--preflight'),
  }).catch(error => {
    console.error(String(error.message).replaceAll(process.env.SUPABASE_ACCESS_TOKEN || 'NO_TOKEN', '[redacted]'));
    process.exitCode = 1;
  });
}
