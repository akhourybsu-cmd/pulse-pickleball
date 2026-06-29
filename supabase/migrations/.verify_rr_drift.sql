-- Verification probe for the three RR migrations flagged as missing
-- on live (20260616120000 / 120100 / 180000). Run this in the Supabase
-- SQL editor pointed at the live project — every row should return
-- `true` once the migrations have been applied.
--
-- This file is named with a leading dot so the migration runner ignores
-- it. It's a diagnostic, not a migration.

SELECT
  -- 20260616120000 — invite codes
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'round_robin_events'
      AND column_name = 'invite_code'
  ) AS has_invite_code_col,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'preview_round_robin_by_code'
  ) AS has_preview_rpc,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'join_round_robin_by_code'
  ) AS has_join_rpc,

  -- 20260616120100 — score pipeline
  EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'matches'
      AND column_name = 'count_for_rating'
  ) AS has_count_for_rating_col,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'submit_rr_match_score'
  ) AS has_submit_rr_rpc,

  -- 20260616180000 — voided status
  EXISTS(
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'round_robin_status'
      AND e.enumlabel = 'voided'
  ) AS has_voided_enum,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'void_round_robin_event'
  ) AS has_void_rpc,
  EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'delete_round_robin_event'
  ) AS has_delete_rr_rpc;
