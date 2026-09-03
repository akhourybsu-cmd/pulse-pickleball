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
