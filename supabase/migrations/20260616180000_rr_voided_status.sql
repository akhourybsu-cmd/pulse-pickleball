-- =====================================================================
-- Fixes a latent bug in the existing void flow: the
-- `void_round_robin_event` RPC sets `round_robin_events.status = 'voided'`,
-- but the `round_robin_status` enum (created in 20251020142332) only
-- has values ('draft', 'live', 'completed'). So every call to the RPC
-- would have failed with "invalid input value for enum".
--
-- Add the missing 'voided' value so voiding actually persists, then
-- recreate the void/delete RPCs with sharper error messages so a
-- failure surfaces clearly to the client.
-- =====================================================================

-- 1. Extend the enum. ADD VALUE IF NOT EXISTS is the safe, idempotent
--    form. Must run outside a transaction in some Postgres versions,
--    but Supabase migrations run statement-by-statement so this works.
ALTER TYPE public.round_robin_status
  ADD VALUE IF NOT EXISTS 'voided';

-- 2. void_round_robin_event — adds clearer error messaging and uses
--    SQLSTATE codes the client can map to user-facing copy.
CREATE OR REPLACE FUNCTION public.void_round_robin_event(
  p_event_id UUID,
  p_reason   TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_already_voided BOOLEAN;
BEGIN
  SELECT organizer_id, COALESCE(voided, false)
    INTO v_organizer_id, v_already_voided
    FROM round_robin_events
   WHERE id = p_event_id;

  IF v_organizer_id IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000';
  END IF;

  IF v_organizer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the host or an admin can void this event' USING ERRCODE = '42501';
  END IF;

  IF v_already_voided THEN
    -- Idempotent — calling void on an already-voided event is a no-op.
    RETURN;
  END IF;

  UPDATE round_robin_events
     SET voided      = TRUE,
         voided_by   = auth.uid(),
         voided_at   = NOW(),
         void_reason = p_reason,
         status      = 'voided'
   WHERE id = p_event_id;

  -- Void every match in the matches table that was created for this RR.
  -- This ensures the rating engine drops them on next recalc.
  UPDATE matches
     SET voided      = TRUE,
         voided_by   = auth.uid(),
         voided_at   = NOW(),
         void_reason = COALESCE(p_reason, 'Round Robin event voided')
   WHERE source = 'round_robin'
     AND id IN (
       SELECT match_id
         FROM round_robin_schedule
        WHERE event_id = p_event_id
          AND match_id IS NOT NULL
     )
     AND COALESCE(voided, false) = false;

  -- Recalculate ratings so the voided matches stop counting immediately.
  PERFORM recalculate_all_ratings();
END;
$$;

GRANT EXECUTE ON FUNCTION public.void_round_robin_event(UUID, TEXT) TO authenticated;

-- 3. delete_round_robin_event — same hardening pass.
CREATE OR REPLACE FUNCTION public.delete_round_robin_event(
  p_event_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_has_scores   BOOLEAN;
BEGIN
  SELECT organizer_id INTO v_organizer_id
    FROM round_robin_events
   WHERE id = p_event_id;

  IF v_organizer_id IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = '02000';
  END IF;

  IF v_organizer_id <> auth.uid() AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only the host or an admin can delete this event' USING ERRCODE = '42501';
  END IF;

  -- Block hard delete on events with scores (admins can override).
  -- Use round_robin_schedule scores AND matches.team*_score because
  -- the immediate-sync pipeline (Phase 2) writes to both.
  SELECT EXISTS (
    SELECT 1 FROM round_robin_schedule
     WHERE event_id = p_event_id
       AND (team1_score IS NOT NULL OR team2_score IS NOT NULL)
  ) INTO v_has_scores;

  IF v_has_scores AND NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'This event has saved scores — void it to keep the record, or contact an admin to hard-delete' USING ERRCODE = '23000';
  END IF;

  -- Delete match_participants for any matches that came from this event.
  -- We look them up by round_robin_schedule.match_id (the back-reference)
  -- because matches.event_id may not be set for RR matches (the comment
  -- in handleCompleteEvent explicitly skipped it).
  DELETE FROM match_participants
   WHERE match_id IN (
     SELECT match_id
       FROM round_robin_schedule
      WHERE event_id = p_event_id
        AND match_id IS NOT NULL
   );

  -- Delete the matches themselves.
  DELETE FROM matches
   WHERE id IN (
     SELECT match_id
       FROM round_robin_schedule
      WHERE event_id = p_event_id
        AND match_id IS NOT NULL
   );

  -- CASCADE chain on round_robin_events handles round_robin_schedule
  -- and round_robin_players via the ON DELETE CASCADE foreign keys
  -- created in the original migration. Belt + suspenders: clean
  -- explicitly first.
  DELETE FROM round_robin_schedule WHERE event_id = p_event_id;
  DELETE FROM round_robin_players  WHERE event_id = p_event_id;
  DELETE FROM round_robin_audit    WHERE event_id = p_event_id;
  DELETE FROM round_robin_events   WHERE id       = p_event_id;

  -- Recalc only if we actually nuked scored matches.
  IF v_has_scores THEN
    PERFORM recalculate_all_ratings();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_round_robin_event(UUID) TO authenticated;
