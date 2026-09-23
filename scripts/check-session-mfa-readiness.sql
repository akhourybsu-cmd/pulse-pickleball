-- Read-only release checks. Run as the migration administrator after deploying
-- the migrations. Do not enable the new frontend while any required item fails.
SELECT to_regprocedure('public.pulse_mfa_status()') IS NOT NULL AS session_mfa_installed,
       to_regprocedure('public.import_guest_skill_assessment(uuid,uuid,jsonb,jsonb)') IS NOT NULL AS guest_claim_installed;

SELECT setting AS data_api_guard
FROM pg_roles r, unnest(r.rolconfig) setting
WHERE r.rolname = 'authenticator' AND setting LIKE 'pgrst.db_pre_request=%';
-- Expected: pgrst.db_pre_request=public.pulse_enforce_mfa (or an explicitly chained hook).

-- Expected: zero rows. Repeat this check when adding tables in later releases.
SELECT n.nspname AS schema_name, c.relname AS table_name
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p')
  AND (n.nspname='public' OR (n.nspname='storage' AND c.relname='objects') OR (n.nspname='realtime' AND c.relname='messages'))
  AND (NOT c.relrowsecurity OR NOT EXISTS (
    SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='pulse_required_mfa' AND NOT p.polpermissive
  ));

-- Expected: false for browser grants. Legacy minting functions must be retired.
SELECT role_name, p.oid::regprocedure::text AS function_name,
       has_function_privilege(role_name,p.oid,'EXECUTE') AS browser_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
CROSS JOIN (VALUES ('anon'),('authenticated')) AS roles(role_name)
WHERE n.nspname='public' AND p.proname IN
  ('pulse_issue_mfa_email','pulse_verify_mfa_email','pulse_cancel_mfa_email','insert_mfa_code','verify_and_use_mfa_code','import_guest_skill_assessment');

-- Counts only; do not export account details. Resolve stale preferences using
-- an authenticated recovery process before enabling the new login flow.
SELECT count(*) FILTER (WHERE mfa_method='sms') AS unsupported_sms_preferences,
       count(*) FILTER (WHERE mfa_method='authenticator' AND NOT EXISTS (
         SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=p.id AND f.status='verified'
       )) AS authenticator_preferences_without_factor
FROM public.profiles p;
