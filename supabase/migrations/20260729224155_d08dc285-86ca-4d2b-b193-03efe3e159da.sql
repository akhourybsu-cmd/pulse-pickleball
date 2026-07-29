CREATE TABLE IF NOT EXISTS public.skill_organizer_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  league_id     UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  attempt_id    UUID REFERENCES public.skill_assessment_attempts(id) ON DELETE SET NULL,
  reviewer_id   UUID NOT NULL REFERENCES public.profiles(id),
  review_status TEXT NOT NULL CHECK (review_status IN
                  ('review_recommended','reviewed','appropriate','too_low','too_high')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_reviews_player_league
  ON public.skill_organizer_reviews (player_id, league_id, created_at DESC);

ALTER TABLE public.skill_organizer_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skill_reviews_select ON public.skill_organizer_reviews;
CREATE POLICY skill_reviews_select ON public.skill_organizer_reviews
  FOR SELECT USING (
    public.is_league_admin(league_id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );
DROP POLICY IF EXISTS skill_reviews_insert ON public.skill_organizer_reviews;
CREATE POLICY skill_reviews_insert ON public.skill_organizer_reviews
  FOR INSERT WITH CHECK (
    reviewer_id = auth.uid()
    AND public.is_league_admin(league_id, auth.uid())
  );
DROP POLICY IF EXISTS skill_reviews_admin ON public.skill_organizer_reviews;
CREATE POLICY skill_reviews_admin ON public.skill_organizer_reviews
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT ON public.skill_organizer_reviews TO authenticated;
GRANT ALL ON public.skill_organizer_reviews TO service_role;

CREATE OR REPLACE FUNCTION public.record_skill_review(
  p_player_id     UUID,
  p_league_id     UUID,
  p_review_status TEXT,
  p_note          TEXT DEFAULT NULL,
  p_attempt_id    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT (public.is_league_admin(p_league_id, v_uid) OR public.has_role(v_uid, 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_review_status NOT IN ('review_recommended','reviewed','appropriate','too_low','too_high') THEN
    RAISE EXCEPTION 'Invalid review status' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.skill_organizer_reviews
    (player_id, league_id, attempt_id, reviewer_id, review_status, note)
  VALUES (p_player_id, p_league_id, p_attempt_id, v_uid, p_review_status, NULLIF(TRIM(COALESCE(p_note,'')), ''))
  RETURNING id INTO v_id;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (p_league_id, NULL, v_uid, 'skill.review_recorded', 'player', p_player_id,
          jsonb_build_object('review_status', p_review_status));

  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.record_skill_review(UUID, UUID, TEXT, TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_player_skill_card(
  p_player_id UUID,
  p_league_id UUID DEFAULT NULL
)
RETURNS TABLE (
  player_id            UUID,
  self_assessed_level  NUMERIC,
  self_assessed_band   TEXT,
  lower_bound          NUMERIC,
  upper_bound          NUMERIC,
  confidence_score     INTEGER,
  confidence_label     TEXT,
  provisional_status   BOOLEAN,
  self_assessed_at     TIMESTAMPTZ,
  primary_style        TEXT,
  secondary_style      TEXT,
  preferred_side       TEXT,
  handedness           TEXT,
  review_recommended   BOOLEAN,
  latest_review_status TEXT,
  card                 JSONB
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_is_org BOOLEAN := public.has_role(v_uid, 'admin'::public.app_role)
                      OR (p_league_id IS NOT NULL AND public.is_league_admin(p_league_id, v_uid));
BEGIN
  IF NOT public.can_view_player_skill(p_player_id) THEN
    RAISE EXCEPTION 'Not authorized to view this player''s skill data' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT
      p.player_id,
      p.self_assessed_level,
      p.self_assessed_band,
      a.lower_bound,
      a.upper_bound,
      a.confidence_score,
      a.confidence_label,
      p.provisional_status,
      a.completed_at,
      a.primary_style,
      a.secondary_style,
      p.preferred_side,
      COALESCE(p.handedness, pr.handedness),
      (COALESCE(a.confidence_score, 0) < 60
        OR COALESCE((a.scoring_snapshot->'meta'->>'contradictionSeverity')::INT, 0) > 0) AS review_recommended,
      CASE WHEN v_is_org THEN (
        SELECT r.review_status FROM public.skill_organizer_reviews r
         WHERE r.player_id = p.player_id
           AND (p_league_id IS NULL OR r.league_id = p_league_id)
         ORDER BY r.created_at DESC LIMIT 1
      ) ELSE NULL END AS latest_review_status,
      ((a.scoring_snapshot - 'contradictions') - 'meta') AS card
    FROM public.player_skill_profiles p
    LEFT JOIN public.profiles pr ON pr.id = p.player_id
    LEFT JOIN LATERAL (
      SELECT * FROM public.skill_assessment_attempts aa
       WHERE aa.player_id = p.player_id AND aa.status = 'completed'
       ORDER BY aa.completed_at DESC LIMIT 1
    ) a ON TRUE
    WHERE p.player_id = p_player_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_player_skill_card(UUID, UUID) TO authenticated;

DROP FUNCTION IF EXISTS public.get_league_skill_cards(UUID);
CREATE FUNCTION public.get_league_skill_cards(p_league_id UUID)
RETURNS TABLE (
  player_id            UUID,
  self_assessed_level  NUMERIC,
  self_assessed_band   TEXT,
  confidence           INTEGER,
  provisional_status   BOOLEAN,
  preferred_side       TEXT,
  self_assessed_at     TIMESTAMPTZ,
  primary_style        TEXT,
  secondary_style      TEXT,
  review_recommended   BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT
      p.player_id, p.self_assessed_level, p.self_assessed_band,
      p.self_assessment_confidence, p.provisional_status, p.preferred_side,
      a.completed_at, a.primary_style, a.secondary_style,
      (COALESCE(p.self_assessment_confidence, 0) < 60
        OR COALESCE((a.scoring_snapshot->'meta'->>'contradictionSeverity')::INT, 0) > 0) AS review_recommended
    FROM public.player_skill_profiles p
    JOIN public.league_members m ON m.user_id = p.player_id
    LEFT JOIN LATERAL (
      SELECT * FROM public.skill_assessment_attempts aa
       WHERE aa.player_id = p.player_id AND aa.status = 'completed'
       ORDER BY aa.completed_at DESC LIMIT 1
    ) a ON TRUE
    WHERE m.league_id = p_league_id
      AND COALESCE(p.visibility, 'organizers') <> 'private';
END; $$;
GRANT EXECUTE ON FUNCTION public.get_league_skill_cards(UUID) TO authenticated;