-- Read-only post-smoke audit. Never restore or truncate to run these checks.
BEGIN READ ONLY;

SELECT 'auth_users' AS metric, count(*) FROM auth.users
UNION ALL SELECT 'auth_identities', count(*) FROM auth.identities
UNION ALL SELECT 'storage_objects', count(*) FROM storage.objects
UNION ALL SELECT 'temporary_test_users', count(*) FROM auth.users WHERE email LIKE 'pulse-migration-%@example.com'
UNION ALL SELECT 'temporary_test_groups', count(*) FROM public.groups WHERE name LIKE 'Migration QA %'
UNION ALL SELECT 'temporary_test_venues', count(*) FROM public.venues WHERE slug LIKE 'migration-qa-%';

DO $$
DECLARE
  fk record;
  join_condition text;
  non_null_condition text;
  violations bigint;
  checked integer := 0;
BEGIN
  FOR fk IN
    SELECT c.*, n.nspname child_schema, t.relname child_table,
      pn.nspname parent_schema, pt.relname parent_table
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class pt ON pt.oid = c.confrelid
    JOIN pg_namespace pn ON pn.oid = pt.relnamespace
    WHERE c.contype = 'f' AND n.nspname IN ('public', 'auth')
  LOOP
    SELECT string_agg(format('c.%I = p.%I', ca.attname, pa.attname), ' AND ' ORDER BY ck.ord),
      string_agg(format('c.%I IS NOT NULL', ca.attname), ' AND ' ORDER BY ck.ord)
    INTO join_condition, non_null_condition
    FROM unnest(fk.conkey) WITH ORDINALITY ck(attnum, ord)
    JOIN unnest(fk.confkey) WITH ORDINALITY pk(attnum, ord) USING (ord)
    JOIN pg_attribute ca ON ca.attrelid = fk.conrelid AND ca.attnum = ck.attnum
    JOIN pg_attribute pa ON pa.attrelid = fk.confrelid AND pa.attnum = pk.attnum;
    EXECUTE format('SELECT count(*) FROM %I.%I c WHERE %s AND NOT EXISTS (SELECT 1 FROM %I.%I p WHERE %s)',
      fk.child_schema, fk.child_table, non_null_condition, fk.parent_schema, fk.parent_table, join_condition)
    INTO violations;
    IF violations > 0 THEN RAISE EXCEPTION 'FK orphans: %.% / %: %', fk.child_schema, fk.child_table, fk.conname, violations; END IF;
    checked := checked + 1;
  END LOOP;
  RAISE NOTICE 'Foreign keys checked: %, orphan rows: 0', checked;
END;
$$;

DO $$
DECLARE item record; found_count bigint; checked integer := 0;
BEGIN
  FOR item IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND c.data_type IN ('text', 'character varying', 'json', 'jsonb')
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text LIKE %L OR %I::text LIKE %L',
      item.table_name, item.column_name, '%ryxklkayezjnwwunuphn.supabase.co%',
      item.column_name, '%ca6dbc43-755e-43df-a1af-7527a749b225.lovableproject.com%') INTO found_count;
    IF found_count > 0 THEN RAISE EXCEPTION 'Legacy origin in %.%: %', item.table_name, item.column_name, found_count; END IF;
    checked := checked + 1;
  END LOOP;
  RAISE NOTICE 'Text/JSON columns checked: %, legacy origin references: 0', checked;
END;
$$;

DO $$
DECLARE
  item record;
  checked integer := 0;
BEGIN
  FOR item IN
    SELECT p.oid, p.oid::regprocedure AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'enqueue_email',
        'read_email_batch',
        'delete_email',
        'move_to_dlq'
      ])
  LOOP
    IF has_function_privilege('anon', item.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', item.oid, 'EXECUTE')
       OR has_function_privilege('public', item.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Privileged queue function exposed to app roles: %', item.function_name;
    END IF;

    IF NOT has_function_privilege('service_role', item.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service role cannot execute queue function: %', item.function_name;
    END IF;

    checked := checked + 1;
  END LOOP;

  IF checked <> 4 THEN
    RAISE EXCEPTION 'Expected 4 privileged queue functions, found %', checked;
  END IF;

  RAISE NOTICE 'Privileged queue functions checked: %, app-role exposure: 0', checked;
END;
$$;

DO $$
DECLARE
  public_venue_inquiry_policies integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('conversations', 'court_channels')
      AND cmd = 'INSERT'
  ) THEN
    RAISE EXCEPTION 'Obsolete direct INSERT policy exists on conversations or court_channels';
  END IF;

  SELECT count(*)
  INTO public_venue_inquiry_policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'venue_inquiries'
    AND cmd = 'INSERT'
    AND 'public' = ANY (roles)
    AND coalesce(trim(both '() ' from with_check), '') = 'true';

  IF public_venue_inquiry_policies <> 1 THEN
    RAISE EXCEPTION
      'Expected one public venue inquiry INSERT policy, found %',
      public_venue_inquiry_policies;
  END IF;

  RAISE NOTICE 'Permissive INSERT policy invariants checked';
END;
$$;

DO $$
DECLARE
  exposed_functions text;
BEGIN
  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
  INTO exposed_functions
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef
    AND p.prorettype = 'trigger'::regtype
    AND (
      has_function_privilege('public', p.oid, 'EXECUTE')
      OR has_function_privilege('anon', p.oid, 'EXECUTE')
      OR has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  IF exposed_functions IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY DEFINER trigger functions exposed to app roles: %', exposed_functions;
  END IF;

  RAISE NOTICE 'SECURITY DEFINER trigger functions exposed to app roles: 0';
END;
$$;

DO $$
DECLARE
  item record;
  checked integer := 0;
BEGIN
  FOR item IN
    SELECT
      signature,
      to_regprocedure(signature) AS function_oid
    FROM unnest(ARRAY[
      'public.apply_match_rating_incremental(uuid)',
      'public.assign_players_to_courts(uuid)',
      'public.check_and_award_badges(uuid)',
      'public.cleanup_completed_match(uuid)',
      'public.cleanup_expired_mfa_codes()',
      'public.cleanup_rpc_rate_limit_log()',
      'public.clear_all_match_history()',
      'public.create_notification(uuid,text,text,text,text,text,text,jsonb,uuid,timestamptz)',
      'public.enqueue_notification(uuid,text,text,text,text,text,uuid,jsonb)',
      'public.finalize_stale_pending_matches()',
      'public.freeze_week_ratings(date)',
      'public.recalculate_all_player_stats()',
      'public.recalculate_player_stats(uuid)'
    ]) AS signatures(signature)
  LOOP
    IF item.function_oid IS NULL THEN
      RAISE EXCEPTION 'Expected internal maintenance function is missing: %', item.signature;
    END IF;

    IF has_function_privilege('public', item.function_oid, 'EXECUTE')
       OR has_function_privilege('anon', item.function_oid, 'EXECUTE')
       OR has_function_privilege('authenticated', item.function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Internal maintenance function exposed to app roles: %', item.signature;
    END IF;

    IF NOT has_function_privilege('service_role', item.function_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'Service role cannot execute maintenance function: %', item.signature;
    END IF;

    checked := checked + 1;
  END LOOP;

  RAISE NOTICE 'Internal maintenance functions checked: %, app-role exposure: 0', checked;
END;
$$;

DO $$
DECLARE
  job_count integer;
  all_active boolean;
  all_unique boolean;
  all_hardened boolean;
BEGIN
  SELECT
    count(*),
    bool_and(active),
    bool_and(copies = 1),
    bool_and(command LIKE '%timeout_milliseconds := 20000%')
  INTO job_count, all_active, all_unique, all_hardened
  FROM (
    SELECT
      active,
      command,
      count(*) OVER (PARTITION BY jobname) AS copies
    FROM cron.job
    WHERE jobname = ANY (ARRAY[
      'send-event-reminders',
      'process-waitlist',
      'process-email-queue',
      'cleanup-old-messages',
      'delete-old-posts'
    ])
  ) jobs;

  IF job_count <> 5 OR NOT all_active OR NOT all_unique OR NOT all_hardened THEN
    RAISE EXCEPTION
      'Scheduled job invariant failed (count %, active %, unique %, hardened %)',
      job_count, all_active, all_unique, all_hardened;
  END IF;

  RAISE NOTICE 'Scheduled jobs checked: 5, active/unique/hardened: true';
END;
$$;

SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
SELECT status_code, timed_out, count(*) FROM net._http_response
WHERE created > now() - interval '1 hour' GROUP BY status_code, timed_out ORDER BY status_code;
SELECT status, count(*), min(created_at), max(created_at) FROM public.email_send_log GROUP BY status ORDER BY status;
SELECT CASE WHEN error_message LIKE '%no_matching_sender%' THEN 'historical_sender_domain_error'
  ELSE 'other_error' END AS error_category, count(*)
FROM public.email_send_log WHERE status = 'dlq' GROUP BY error_category;
SELECT 'auth_queue' AS queue, count(*) FROM pgmq.q_auth_emails
UNION ALL SELECT 'transactional_queue', count(*) FROM pgmq.q_transactional_emails;
COMMIT;
