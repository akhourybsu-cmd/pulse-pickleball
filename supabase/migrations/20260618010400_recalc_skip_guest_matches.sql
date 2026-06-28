-- =====================================================================
-- recalculate_all_ratings — skip matches with guest participants
-- (Phase 2.A.5).
--
-- The previous body (migration 20260616120100) used
-- `HAVING COUNT(*) = 4` on the participant aggregate. COUNT(*) counts
-- every match_participants row regardless of player_id, so a match
-- with 1 real player + 3 guests (`mp.player_id` NULL on the guests)
-- still passed the HAVING and entered the rating loop. The loop then
-- assigned NULL to p2_id..p4_id and downstream lookups returned the
-- default 3.00 rating, corrupting the rating chain.
--
-- Fix: change to `HAVING COUNT(mp.player_id) = 4` — counts only
-- non-null player_ids, so any match with a guest is silently
-- excluded from rating calc. Per the design, guest-containing matches
-- still appear in match history but don't contribute to PULSE rating.
--
-- This is the only line that changed; the rest of the function body
-- is reproduced verbatim from 20260616120100 for the CREATE OR
-- REPLACE to be complete.
-- =====================================================================

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
   -- Phase 2.A.5: COUNT(mp.player_id) excludes participant rows where
   -- player_id IS NULL (guest_match_players). Matches with any guest
   -- never reach 4 non-null player_ids and are correctly skipped.
   HAVING COUNT(mp.player_id) = 4
   ORDER BY m.match_date, m.created_at, m.id
  LOOP
    p1_id := match_record.player_ids[1];
    p2_id := match_record.player_ids[2];
    p3_id := match_record.player_ids[3];
    p4_id := match_record.player_ids[4];

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
       SET rating_before = p1_rating, rating_after = p1_rating + v_rating_change, rating_change = v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p1_id;
    UPDATE match_participants
       SET rating_before = p2_rating, rating_after = p2_rating + v_rating_change, rating_change = v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p2_id;
    UPDATE match_participants
       SET rating_before = p3_rating, rating_after = p3_rating - v_rating_change, rating_change = -v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p3_id;
    UPDATE match_participants
       SET rating_before = p4_rating, rating_after = p4_rating - v_rating_change, rating_change = -v_rating_change
     WHERE match_id = match_record.match_id AND player_id = p4_id;

    UPDATE profiles SET current_rating = p1_rating + v_rating_change WHERE id = p1_id;
    UPDATE profiles SET current_rating = p2_rating + v_rating_change WHERE id = p2_id;
    UPDATE profiles SET current_rating = p3_rating - v_rating_change WHERE id = p3_id;
    UPDATE profiles SET current_rating = p4_rating - v_rating_change WHERE id = p4_id;
  END LOOP;

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
