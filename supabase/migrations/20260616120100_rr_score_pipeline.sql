-- =====================================================================
-- Round Robin score pipeline reliability (Phase 2 of the RR overhaul).
--
-- Three fixes to the score → match-history → rating-engine pipeline
-- that were flagged in the audit:
--
--   1. Add matches.count_for_rating boolean. Lets non-rating events
--      (rating_eligible=false) be visible in match history but NOT
--      counted by the rating engine.
--   2. Update recalculate_all_ratings to honor count_for_rating AND
--      voided. Previously voided matches were still being counted —
--      the audit's #4 severity finding.
--   3. New RPC submit_rr_match_score: atomic per-score sync into the
--      matches + match_participants tables. Idempotent — calling it
--      with a different score on a synced match UPDATEs instead of
--      INSERTing a duplicate. Fixes the orphan + duplication risks
--      (audit findings #1 and #2).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema change
-- ---------------------------------------------------------------------

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS count_for_rating BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.matches.count_for_rating IS
  'When false, the match is visible in match history (PerformanceModule, '
  'MatchHistory, ViewProfile) but excluded from rating calculations. '
  'Set to false for non-rating Round Robin events (rating_eligible=false), '
  'casual matches, etc. Existing rows default to true so current behavior '
  'is preserved.';

-- Backfill any existing RR matches whose parent event is rating-ineligible.
UPDATE public.matches m
   SET count_for_rating = false
  FROM public.round_robin_schedule s
  JOIN public.round_robin_events e ON e.id = s.event_id
 WHERE s.match_id    = m.id
   AND e.rating_eligible = false
   AND m.count_for_rating IS DISTINCT FROM false;

-- ---------------------------------------------------------------------
-- 2. Update recalculate_all_ratings to filter voided + count_for_rating
--    Function body is identical to the existing definition (migration
--    20251002115118) EXCEPT every WHERE m.status='approved' is extended
--    with the two new exclusion filters.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recalculate_all_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  match_record    RECORD;
  player_record   RECORD;

  p1_id UUID; p2_id UUID; p3_id UUID; p4_id UUID;
  p1_rating NUMERIC; p2_rating NUMERIC; p3_rating NUMERIC; p4_rating NUMERIC;
  p1_matches INTEGER; p2_matches INTEGER; p3_matches INTEGER; p4_matches INTEGER;

  v_rating_change NUMERIC;
  current_week    DATE;
BEGIN
  current_week := get_week_start(CURRENT_DATE);

  UPDATE profiles
     SET current_rating     = 3.00,
         week_start_rating  = 3.00,
         week_start_date    = current_week
   WHERE id IS NOT NULL;

  -- Iterate every approved, non-voided, rating-counted match.
  FOR match_record IN
    SELECT
      m.id          AS match_id,
      m.match_date,
      m.team1_score,
      m.team2_score,
      m.match_type,
      m.week_start,
      m.created_at,
      array_agg(mp.player_id ORDER BY mp.team, mp.id) AS player_ids,
      array_agg(mp.team      ORDER BY mp.team, mp.id) AS teams
    FROM matches m
    JOIN match_participants mp ON mp.match_id = m.id
   WHERE m.status = 'approved'
     AND COALESCE(m.voided, false)         = false
     AND COALESCE(m.count_for_rating, true) = true
    GROUP BY m.id, m.match_date, m.team1_score, m.team2_score, m.match_type, m.week_start, m.created_at
   HAVING COUNT(*) = 4
   ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p1_id := match_record.player_ids[1];
    p2_id := match_record.player_ids[2];
    p3_id := match_record.player_ids[3];
    p4_id := match_record.player_ids[4];

    -- Look up each player's most-recent cumulative rating BEFORE this match.
    SELECT COALESCE(
      (SELECT mp_sub.rating_after
         FROM match_participants mp_sub
         JOIN matches m_sub ON mp_sub.match_id = m_sub.id
        WHERE mp_sub.player_id = p1_id
          AND m_sub.status = 'approved'
          AND COALESCE(m_sub.voided, false)         = false
          AND COALESCE(m_sub.count_for_rating, true) = true
          AND (m_sub.match_date < match_record.match_date
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
        ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
        LIMIT 1),
      3.00
    ), p.total_matches INTO p1_rating, p1_matches
    FROM profiles p WHERE p.id = p1_id;

    SELECT COALESCE(
      (SELECT mp_sub.rating_after
         FROM match_participants mp_sub
         JOIN matches m_sub ON mp_sub.match_id = m_sub.id
        WHERE mp_sub.player_id = p2_id
          AND m_sub.status = 'approved'
          AND COALESCE(m_sub.voided, false)         = false
          AND COALESCE(m_sub.count_for_rating, true) = true
          AND (m_sub.match_date < match_record.match_date
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
        ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
        LIMIT 1),
      3.00
    ), p.total_matches INTO p2_rating, p2_matches
    FROM profiles p WHERE p.id = p2_id;

    SELECT COALESCE(
      (SELECT mp_sub.rating_after
         FROM match_participants mp_sub
         JOIN matches m_sub ON mp_sub.match_id = m_sub.id
        WHERE mp_sub.player_id = p3_id
          AND m_sub.status = 'approved'
          AND COALESCE(m_sub.voided, false)         = false
          AND COALESCE(m_sub.count_for_rating, true) = true
          AND (m_sub.match_date < match_record.match_date
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
        ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
        LIMIT 1),
      3.00
    ), p.total_matches INTO p3_rating, p3_matches
    FROM profiles p WHERE p.id = p3_id;

    SELECT COALESCE(
      (SELECT mp_sub.rating_after
         FROM match_participants mp_sub
         JOIN matches m_sub ON mp_sub.match_id = m_sub.id
        WHERE mp_sub.player_id = p4_id
          AND m_sub.status = 'approved'
          AND COALESCE(m_sub.voided, false)         = false
          AND COALESCE(m_sub.count_for_rating, true) = true
          AND (m_sub.match_date < match_record.match_date
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at < match_record.created_at)
               OR (m_sub.match_date = match_record.match_date AND m_sub.created_at = match_record.created_at AND m_sub.id < match_record.match_id))
        ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
        LIMIT 1),
      3.00
    ), p.total_matches INTO p4_rating, p4_matches
    FROM profiles p WHERE p.id = p4_id;

    v_rating_change := calculate_pulse_rating_change(
      p1_rating, p2_rating, p3_rating, p4_rating,
      match_record.team1_score, match_record.team2_score,
      match_record.team1_score > match_record.team2_score,
      match_record.match_type,
      p1_matches
    );

    UPDATE match_participants
       SET rating_before = p1_rating,
           rating_after  = p1_rating + v_rating_change,
           rating_change = v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p1_id;

    UPDATE match_participants
       SET rating_before = p2_rating,
           rating_after  = p2_rating + v_rating_change,
           rating_change = v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p2_id;

    UPDATE match_participants
       SET rating_before = p3_rating,
           rating_after  = p3_rating - v_rating_change,
           rating_change = -v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p3_id;

    UPDATE match_participants
       SET rating_before = p4_rating,
           rating_after  = p4_rating - v_rating_change,
           rating_change = -v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p4_id;

    UPDATE profiles SET current_rating = p1_rating + v_rating_change WHERE id = p1_id;
    UPDATE profiles SET current_rating = p2_rating + v_rating_change WHERE id = p2_id;
    UPDATE profiles SET current_rating = p3_rating - v_rating_change WHERE id = p3_id;
    UPDATE profiles SET current_rating = p4_rating - v_rating_change WHERE id = p4_id;
  END LOOP;

  -- Snapshot week_start_rating for every profile.
  FOR player_record IN SELECT id FROM profiles
  LOOP
    UPDATE profiles
       SET week_start_rating = COALESCE(
             (SELECT mp_sub.rating_after
                FROM match_participants mp_sub
                JOIN matches m_sub ON mp_sub.match_id = m_sub.id
               WHERE mp_sub.player_id = player_record.id
                 AND m_sub.status = 'approved'
                 AND COALESCE(m_sub.voided, false)         = false
                 AND COALESCE(m_sub.count_for_rating, true) = true
                 AND m_sub.week_start < current_week
               ORDER BY m_sub.match_date DESC, m_sub.created_at DESC, m_sub.id DESC
               LIMIT 1),
             3.00
           ),
           week_start_date = current_week
     WHERE id = player_record.id;
  END LOOP;

  PERFORM recalculate_all_player_stats();
END;
$function$;

-- ---------------------------------------------------------------------
-- 3. submit_rr_match_score — atomic per-score sync.
--
--    Called from the client every time a host saves a score (whether
--    first-time entry or an edit). Instead of writing only to
--    round_robin_schedule and deferring the matches/match_participants
--    insert until handleCompleteEvent, this RPC keeps both stores in
--    lockstep on every save.
--
--    Idempotent: if round_robin_schedule.match_id already exists, the
--    matches row is UPDATEd. Otherwise a new matches row is inserted,
--    match_participants rows are populated, and the schedule row's
--    match_id is filled in.
--
--    Authorization: the event's organizer or an admin only.
--
--    Returns the matches.id of the synced row.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_rr_match_score(
  p_schedule_id  UUID,
  p_team1_score  INT,
  p_team2_score  INT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_schedule         RECORD;
  v_event            RECORD;
  v_user_id          UUID := auth.uid();
  v_match_id         UUID;
  v_court_id         UUID;
  v_count_for_rating BOOLEAN;
  v_participant_ids  UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Look up the schedule row.
  SELECT * INTO v_schedule
    FROM round_robin_schedule
   WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Schedule row not found' USING ERRCODE = '02000';
  END IF;

  IF v_schedule.is_bye THEN
    RAISE EXCEPTION 'Cannot submit a score for a bye match';
  END IF;

  -- Look up the parent event so we can authorize and check rating settings.
  SELECT * INTO v_event
    FROM round_robin_events
   WHERE id = v_schedule.event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parent event not found';
  END IF;

  IF v_event.organizer_id <> v_user_id AND NOT public.has_role(v_user_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized to submit scores for this event' USING ERRCODE = '42501';
  END IF;

  -- All four player slots must be filled.
  IF v_schedule.a1_player_id IS NULL OR v_schedule.a2_player_id IS NULL
     OR v_schedule.b1_player_id IS NULL OR v_schedule.b2_player_id IS NULL THEN
    RAISE EXCEPTION 'Match has unfilled player slots; cannot submit score';
  END IF;

  v_count_for_rating := COALESCE(v_event.rating_eligible, true);

  -- Resolve court_id: event.location may be a court UUID or a name.
  IF v_event.location IS NOT NULL THEN
    BEGIN
      v_court_id := v_event.location::UUID;
    EXCEPTION WHEN invalid_text_representation THEN
      SELECT id INTO v_court_id FROM courts WHERE name = v_event.location LIMIT 1;
    END;
  END IF;

  -- Update the schedule scores (source-of-truth for in-progress display).
  UPDATE round_robin_schedule
     SET team1_score = p_team1_score,
         team2_score = p_team2_score
   WHERE id = p_schedule_id;

  v_participant_ids := ARRAY[
    v_schedule.a1_player_id,
    v_schedule.a2_player_id,
    v_schedule.b1_player_id,
    v_schedule.b2_player_id
  ];

  IF v_schedule.match_id IS NOT NULL THEN
    -- Already synced — UPDATE the existing matches row.
    UPDATE matches
       SET team1_score      = p_team1_score,
           team2_score      = p_team2_score,
           verified_by      = v_participant_ids,
           court_id         = v_court_id,
           other_location   = CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
           count_for_rating = v_count_for_rating
     WHERE id = v_schedule.match_id;

    v_match_id := v_schedule.match_id;

  ELSE
    -- First-time sync — INSERT match + match_participants and link back.
    INSERT INTO matches (
      match_date, team1_score, team2_score, created_by,
      source, round_no, court_no, court_id, other_location,
      match_type, status, verified_by, count_for_rating
    ) VALUES (
      v_event.date, p_team1_score, p_team2_score, v_user_id,
      'round_robin', v_schedule.round_no, v_schedule.court_no,
      v_court_id,
      CASE WHEN v_court_id IS NULL THEN v_event.location ELSE NULL END,
      v_event.rating_type::TEXT,
      'approved',
      v_participant_ids,
      v_count_for_rating
    )
    RETURNING id INTO v_match_id;

    INSERT INTO match_participants (match_id, player_id, team) VALUES
      (v_match_id, v_schedule.a1_player_id, 1),
      (v_match_id, v_schedule.a2_player_id, 1),
      (v_match_id, v_schedule.b1_player_id, 2),
      (v_match_id, v_schedule.b2_player_id, 2);

    UPDATE round_robin_schedule
       SET match_id = v_match_id
     WHERE id = p_schedule_id;
  END IF;

  -- Audit.
  INSERT INTO round_robin_audit (event_id, editor_id, change_type, changes, reason)
  VALUES (
    v_event.id,
    v_user_id,
    'score_submit',
    jsonb_build_object(
      'schedule_id',      p_schedule_id,
      'match_id',         v_match_id,
      'team1_score',      p_team1_score,
      'team2_score',      p_team2_score,
      'count_for_rating', v_count_for_rating
    ),
    'Score submitted for Round ' || v_schedule.round_no || ', Court ' || v_schedule.court_no
  );

  RETURN v_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_rr_match_score(UUID, INT, INT)
  TO authenticated;

-- Recalculate ratings once so the new filters take effect on existing data.
SELECT public.recalculate_all_ratings();
