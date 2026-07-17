-- =========================================================================
-- Slice 2b — post-deploy verification (read-only catalog assertions).
--
-- Run this in the Supabase SQL editor (or psql) AFTER applying
-- 20260716210000_slice2b_apply_external_plan.sql. It performs NO writes — it
-- only inspects the catalog and RAISEs if anything is wrong, so it is safe to
-- run against any environment, including production.
--
-- On success it prints "Slice 2b verification: PASS". Any failure aborts with a
-- descriptive message. It does NOT exercise the authenticated apply flow (that
-- needs a signed-in session — see the functional checklist at the bottom).
-- =========================================================================

DO $$
DECLARE
  v_oid            oid;
  v_planner_oid    oid;
  v_proconfig      text[];
  v_prosecdef      boolean;
BEGIN
  -- 1) The 12-arg apply RPC exists (p_plan + p_plan_hash were added).
  SELECT p.oid, p.prosecdef, p.proconfig
    INTO v_oid, v_prosecdef, v_proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'rr_manage_participant'
     AND p.pronargs = 12;
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'FAIL: public.rr_manage_participant(12 args) not found — migration not applied';
  END IF;

  -- 2) It is SECURITY DEFINER with a locked search_path.
  IF NOT v_prosecdef THEN
    RAISE EXCEPTION 'FAIL: rr_manage_participant is not SECURITY DEFINER';
  END IF;
  IF v_proconfig IS NULL OR NOT ('search_path=pg_catalog' = ANY(v_proconfig)) THEN
    RAISE EXCEPTION 'FAIL: rr_manage_participant search_path is not locked to pg_catalog (got %)', v_proconfig;
  END IF;

  -- 3) Execute granted to authenticated, and NOT to anon/public.
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot EXECUTE rr_manage_participant';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can EXECUTE rr_manage_participant (should be revoked)';
  END IF;

  -- 4) The old 10-arg signature is gone (dropped by the migration), so callers
  --    resolve unambiguously to the 12-arg function.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'rr_manage_participant' AND p.pronargs = 10
  ) THEN
    RAISE EXCEPTION 'FAIL: the old 10-arg rr_manage_participant still exists — overload ambiguity';
  END IF;

  -- 5) The internal planner helper exists and is NOT executable by app roles.
  SELECT p.oid INTO v_planner_oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'rr_plan_participant_change';
  IF v_planner_oid IS NULL THEN
    RAISE EXCEPTION 'FAIL: public.rr_plan_participant_change not found';
  END IF;
  IF has_function_privilege('authenticated', v_planner_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can EXECUTE the internal planner (should be revoked)';
  END IF;

  -- 6) The counted view used by standings/ratings exists.
  IF NOT EXISTS (
    SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = 'round_robin_schedule_counted'
  ) THEN
    RAISE EXCEPTION 'FAIL: view public.round_robin_schedule_counted is missing';
  END IF;

  -- 7) Schedule columns the planner/apply path depend on are present.
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'round_robin_schedule'
      AND column_name = 'superseded_by_schedule_id';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: round_robin_schedule.superseded_by_schedule_id missing'; END IF;
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'round_robin_schedule'
      AND column_name = 'voided_at';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: round_robin_schedule.voided_at missing'; END IF;
  PERFORM 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'round_robin_schedule'
      AND column_name = 'abandoned';
  IF NOT FOUND THEN RAISE EXCEPTION 'FAIL: round_robin_schedule.abandoned missing'; END IF;

  RAISE NOTICE 'Slice 2b verification: PASS';
END $$;

-- =========================================================================
-- Functional checklist (run as a signed-in organizer, e.g. via the app or the
-- tests/rr_slice2a vitest harness with env vars set). SQL alone cannot cover
-- these because rr_manage_participant reads auth.uid().
--
--   [ ] preview withdraw (regen_mode=auto) returns a plan, writes nothing
--       (schedule_version, row counts, audit unchanged).
--   [ ] apply withdraw on a fully-future round → reoptimize: the round is
--       rebuilt, the withdrawn player is absent, no player is double-booked,
--       schedule_version bumps by exactly 1.
--   [ ] apply withdraw where a scored row shares the round → that row is
--       preserved; only the unplayed rows change.
--   [ ] apply replace with an alternate → identity swapped in future rounds;
--       a guest substitute flips rating_eligible=false with an audit row.
--   [ ] apply restore → player re-folded into future rounds, or
--       reason='no_future_rounds' when none remain.
--   [ ] repeat any apply with the same request_id → identical response, no
--       second version bump; different inputs + same request_id →
--       idempotency_conflict.
--   [ ] stale p_expected_version → stale_version (retryable).
--   [ ] confirm no round_robin_schedule row WITH score history was DELETEd
--       (rewrite_round only removes unplayed rows).
-- =========================================================================
