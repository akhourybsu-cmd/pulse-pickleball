-- Validate and advance a live round in one transaction. Never infer success
-- from a browser-side UPDATE that matched no rows or returned an error.
BEGIN;

CREATE OR REPLACE FUNCTION public.rr_close_round(
  p_event_id uuid, p_expected_round integer
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event public.round_robin_events%ROWTYPE;
  v_total integer;
  v_pending integer;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Sign in again to close this round.' USING ERRCODE = '42501';
  END IF;
  IF p_expected_round IS NULL OR p_expected_round < 1 THEN
    RAISE EXCEPTION 'Choose a valid active round.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_event FROM public.round_robin_events
    WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_event.organizer_id IS DISTINCT FROM v_actor
     AND NOT COALESCE(public.has_role(v_actor, 'admin'::public.app_role), false) THEN
    RAISE EXCEPTION 'Only the organizer or an admin can close this round.' USING ERRCODE = '42501';
  END IF;
  IF v_event.status <> 'live' OR COALESCE(v_event.voided, false) THEN
    RAISE EXCEPTION 'Only a live event can advance to another round.';
  END IF;
  IF v_event.current_round IS DISTINCT FROM p_expected_round THEN
    RAISE EXCEPTION 'The active round changed. Refresh the event before continuing.' USING ERRCODE = '40001';
  END IF;

  -- Use the same event-then-schedule lock order as schedule rebuilding.
  PERFORM id FROM public.round_robin_schedule
    WHERE event_id = p_event_id AND round_no = p_expected_round
      AND voided_at IS NULL AND superseded_by_schedule_id IS NULL
    ORDER BY id FOR UPDATE;
  SELECT count(*), count(*) FILTER (
    WHERE NOT COALESCE(abandoned, false)
      AND (team1_score IS NULL OR team2_score IS NULL)
  ) INTO v_total, v_pending
  FROM public.round_robin_schedule
  WHERE event_id = p_event_id AND round_no = p_expected_round
    AND NOT is_bye AND voided_at IS NULL AND superseded_by_schedule_id IS NULL;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'This round has no matches. Review the schedule before continuing.';
  END IF;
  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Save scores for all matches before closing this round (% remaining).', v_pending;
  END IF;
  IF p_expected_round >= v_event.num_rounds THEN
    RAISE EXCEPTION 'This is the final round. Use Complete event to finish.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.round_robin_schedule
    WHERE event_id = p_event_id AND round_no = p_expected_round + 1
      AND voided_at IS NULL AND superseded_by_schedule_id IS NULL
  ) THEN
    RAISE EXCEPTION 'The next round has no schedule. Review the schedule before continuing.';
  END IF;

  UPDATE public.round_robin_events
    SET current_round = p_expected_round + 1,
        schedule_version = COALESCE(schedule_version, 0) + 1
    WHERE id = p_event_id;
  INSERT INTO public.round_robin_audit(event_id, editor_id, change_type, changes, reason)
    VALUES (p_event_id, v_actor, 'round_close',
      jsonb_build_object('closed_round', p_expected_round, 'current_round', p_expected_round + 1),
      'Round closed; next round activated');
  RETURN p_expected_round + 1;
END;
$$;

REVOKE ALL ON FUNCTION public.rr_close_round(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rr_close_round(uuid, integer) TO authenticated;
COMMIT;
