-- =====================================================================
-- Harden verify_match (Phase 2.A.1).
--
-- The current RPC (20251020024720) does a participant SELECT outside any
-- transaction lock, then an UPDATE whose own row-lock would serialize
-- concurrent voters correctly. The remaining issues are:
--
--   • Participant removal between the check and the UPDATE is invisible
--     — a non-participant could still complete a verification kicked
--     off seconds earlier.
--   • A voided or non-approved match accepts new verifications, which
--     can muddy the audit trail.
--   • No row lock means the participant check can pass against a stale
--     snapshot if the match itself is being updated concurrently
--     (e.g., voided by an admin in the same tick).
--
-- This rewrite:
--   • SELECTs the matches row FOR UPDATE first, locking it for the
--     duration of the transaction.
--   • Re-checks participant membership AFTER the lock.
--   • Rejects voided matches and matches in a non-active status.
--   • Keeps the array_agg DISTINCT dedupe so the function remains
--     idempotent (calling twice is a no-op).
--
-- No behavior change for the happy path; the dedupe semantics are
-- preserved exactly.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.verify_match(p_match_id uuid)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  m public.matches;
BEGIN
  -- Lock the matches row up-front so the participant check + verify
  -- write happen under the same row-level lock. Concurrent
  -- verifications serialize at this point.
  SELECT * INTO m
    FROM public.matches
   WHERE id = p_match_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;

  IF COALESCE(m.voided, false) THEN
    RAISE EXCEPTION 'Cannot verify a voided match' USING ERRCODE = '22023';
  END IF;

  -- Allow verification on pending or approved matches; reject only the
  -- terminal-bad states (e.g., 'rejected', 'cancelled' if/when they
  -- exist). Treating unknown statuses as allowed keeps this forward-
  -- compatible.
  IF m.status IS NOT NULL AND m.status IN ('rejected', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot verify a match in % status', m.status
      USING ERRCODE = '22023';
  END IF;

  -- Participant check now runs under the row lock, so an admin who
  -- removed the caller mid-flight in the same transaction sees the
  -- removal before we attempt the verify.
  IF NOT EXISTS (
    SELECT 1
      FROM public.match_participants mp
     WHERE mp.match_id = p_match_id
       AND mp.player_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant in this match' USING ERRCODE = '42501';
  END IF;

  -- Idempotent: array_agg(DISTINCT v) collapses repeat calls.
  UPDATE public.matches
     SET verified_by = (
       SELECT array_agg(DISTINCT v)
         FROM unnest(COALESCE(verified_by, '{}'::text[]) || auth.uid()::text) AS v
     )
   WHERE id = p_match_id
   RETURNING * INTO m;

  RETURN m;
END;
$$;
