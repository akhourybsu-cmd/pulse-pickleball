CREATE OR REPLACE FUNCTION public.skill_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TABLE IF NOT EXISTS public.skill_assessment_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_version INTEGER NOT NULL DEFAULT 1,
  item_key           TEXT NOT NULL,
  domain             TEXT NOT NULL,
  subskill           TEXT NOT NULL,
  dimension          TEXT CHECK (dimension IN ('execution','consistency','application','pressure')),
  anchor_level       NUMERIC(2,1) NOT NULL CHECK (anchor_level IN (2.0,2.5,3.0,3.5,4.0,4.5)),
  question_text      TEXT NOT NULL,
  response_type      TEXT NOT NULL DEFAULT 'ability_scale',
  item_weight        NUMERIC NOT NULL DEFAULT 1,
  is_essential       BOOLEAN NOT NULL DEFAULT false,
  contradiction_group TEXT,
  prerequisite_rules JSONB,
  adaptive_rules     JSONB,
  phase              TEXT NOT NULL DEFAULT 'foundation' CHECK (phase IN ('foundation','targeted')),
  display_order      INTEGER NOT NULL DEFAULT 0,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_version, item_key)
);
CREATE INDEX IF NOT EXISTS idx_skill_items_version_active
  ON public.skill_assessment_items (assessment_version, is_active);

CREATE TABLE IF NOT EXISTS public.skill_assessment_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assessment_version    INTEGER NOT NULL,
  scoring_model_version INTEGER,
  assessment_type       TEXT NOT NULL DEFAULT 'full' CHECK (assessment_type IN ('full','quick','court_check')),
  status                TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  started_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  estimated_level_raw   NUMERIC,
  estimated_level_display NUMERIC(2,1),
  display_band          TEXT,
  lower_bound           NUMERIC(2,1),
  upper_bound           NUMERIC(2,1),
  confidence_score      INTEGER,
  confidence_label      TEXT,
  primary_style         TEXT,
  secondary_style       TEXT,
  scoring_snapshot      JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skill_attempt_self_cap CHECK (estimated_level_raw IS NULL OR estimated_level_raw <= 4.7)
);
CREATE INDEX IF NOT EXISTS idx_skill_attempts_player ON public.skill_assessment_attempts (player_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skill_attempts_one_draft
  ON public.skill_assessment_attempts (player_id) WHERE status = 'in_progress';

CREATE TABLE IF NOT EXISTS public.skill_assessment_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES public.skill_assessment_attempts(id) ON DELETE CASCADE,
  item_id          UUID REFERENCES public.skill_assessment_items(id),
  item_key         TEXT NOT NULL,
  response_key     TEXT NOT NULL CHECK (response_key IN
                     ('not_yet','drill_only','occasionally','sometimes','usually','reliably','not_sure')),
  response_value   NUMERIC,
  response_time_ms INTEGER,
  was_skipped      BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, item_key)
);
CREATE INDEX IF NOT EXISTS idx_skill_responses_attempt ON public.skill_assessment_responses (attempt_id);

CREATE TABLE IF NOT EXISTS public.player_skill_profiles (
  player_id                 UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  self_assessed_level       NUMERIC(2,1),
  self_assessed_band        TEXT,
  self_assessed_at          TIMESTAMPTZ,
  self_assessment_confidence INTEGER,
  observed_level            NUMERIC(2,1),
  observed_at               TIMESTAMPTZ,
  performance_level_reference NUMERIC,
  preferred_display_source  TEXT NOT NULL DEFAULT 'self' CHECK (preferred_display_source IN ('self','observed','performance')),
  visibility                TEXT NOT NULL DEFAULT 'organizers' CHECK (visibility IN ('private','organizers','public')),
  preferred_side            TEXT CHECK (preferred_side IN ('left','right','either','no_preference','not_sure')),
  handedness                TEXT CHECK (handedness IN ('left','right','ambidextrous')),
  provisional_status        BOOLEAN NOT NULL DEFAULT true,
  last_reviewed_at          TIMESTAMPTZ,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT skill_profile_self_cap CHECK (self_assessed_level IS NULL OR self_assessed_level <= 4.7)
);

CREATE TABLE IF NOT EXISTS public.player_skill_scores (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id       UUID NOT NULL REFERENCES public.skill_assessment_attempts(id) ON DELETE CASCADE,
  player_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_type       TEXT NOT NULL CHECK (score_type IN ('overall','domain','subskill')),
  score_key        TEXT NOT NULL,
  raw_score        NUMERIC,
  display_score    NUMERIC(2,1),
  confidence_score INTEGER,
  evidence_count   INTEGER,
  scoring_details  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, score_type, score_key)
);
CREATE INDEX IF NOT EXISTS idx_skill_scores_player ON public.player_skill_scores (player_id, score_type);

CREATE TABLE IF NOT EXISTS public.skill_evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  evidence_type    TEXT NOT NULL CHECK (evidence_type IN ('self_assessment','observed','performance','external')),
  source_id        UUID,
  level_value      NUMERIC,
  confidence_value INTEGER,
  submitted_by     UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ,
  notes            TEXT
);
CREATE INDEX IF NOT EXISTS idx_skill_evidence_player ON public.skill_evidence (player_id, evidence_type);

CREATE TABLE IF NOT EXISTS public.skill_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID,
  previous_level  NUMERIC,
  override_level  NUMERIC,
  reason          TEXT,
  created_by      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_skill_overrides_player ON public.skill_overrides (player_id, organization_id);

DROP TRIGGER IF EXISTS trg_skill_items_updated_at ON public.skill_assessment_items;
CREATE TRIGGER trg_skill_items_updated_at BEFORE UPDATE ON public.skill_assessment_items
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();
DROP TRIGGER IF EXISTS trg_skill_attempts_updated_at ON public.skill_assessment_attempts;
CREATE TRIGGER trg_skill_attempts_updated_at BEFORE UPDATE ON public.skill_assessment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();
DROP TRIGGER IF EXISTS trg_skill_responses_updated_at ON public.skill_assessment_responses;
CREATE TRIGGER trg_skill_responses_updated_at BEFORE UPDATE ON public.skill_assessment_responses
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();
DROP TRIGGER IF EXISTS trg_skill_player_profiles_updated_at ON public.player_skill_profiles;
CREATE TRIGGER trg_skill_player_profiles_updated_at BEFORE UPDATE ON public.player_skill_profiles
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();

CREATE OR REPLACE FUNCTION public.skill_attempt_guard()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_is_service BOOLEAN := (COALESCE(auth.role(),'') = 'service_role');
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NOT v_is_service THEN
    RAISE EXCEPTION 'A completed assessment is immutable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_skill_attempt_guard ON public.skill_assessment_attempts;
CREATE TRIGGER trg_skill_attempt_guard BEFORE UPDATE ON public.skill_assessment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.skill_attempt_guard();

CREATE OR REPLACE FUNCTION public.can_view_player_skill(p_player_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  IF v_uid = p_player_id THEN RETURN true; END IF;
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM public.player_skill_profiles p
              WHERE p.player_id = p_player_id AND p.visibility = 'public') THEN
    RETURN true;
  END IF;
  IF EXISTS (
      SELECT 1
        FROM public.league_members m
        JOIN public.leagues l ON l.id = m.league_id
        LEFT JOIN public.player_skill_profiles p ON p.player_id = p_player_id
       WHERE m.user_id = p_player_id
         AND public.is_league_admin(l.id, v_uid)
         AND COALESCE(p.visibility, 'organizers') <> 'private'
  ) THEN
    RETURN true;
  END IF;
  RETURN false;
END; $$;
GRANT EXECUTE ON FUNCTION public.can_view_player_skill(UUID) TO authenticated;

ALTER TABLE public.skill_assessment_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_assessment_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_assessment_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skill_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_skill_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_evidence             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_overrides            ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS skill_items_read ON public.skill_assessment_items;
CREATE POLICY skill_items_read ON public.skill_assessment_items
  FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS skill_items_admin ON public.skill_assessment_items;
CREATE POLICY skill_items_admin ON public.skill_assessment_items
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS skill_attempts_select_own ON public.skill_assessment_attempts;
CREATE POLICY skill_attempts_select_own ON public.skill_assessment_attempts
  FOR SELECT USING (player_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS skill_attempts_insert_own ON public.skill_assessment_attempts;
CREATE POLICY skill_attempts_insert_own ON public.skill_assessment_attempts
  FOR INSERT WITH CHECK (player_id = auth.uid() AND status = 'in_progress');
DROP POLICY IF EXISTS skill_attempts_update_own ON public.skill_assessment_attempts;
CREATE POLICY skill_attempts_update_own ON public.skill_assessment_attempts
  FOR UPDATE USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());
DROP POLICY IF EXISTS skill_attempts_delete_own_draft ON public.skill_assessment_attempts;
CREATE POLICY skill_attempts_delete_own_draft ON public.skill_assessment_attempts
  FOR DELETE USING (player_id = auth.uid() AND status <> 'completed');

DROP POLICY IF EXISTS skill_responses_select_own ON public.skill_assessment_responses;
CREATE POLICY skill_responses_select_own ON public.skill_assessment_responses
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.skill_assessment_attempts a
     WHERE a.id = attempt_id AND (a.player_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))));
DROP POLICY IF EXISTS skill_responses_write_own ON public.skill_assessment_responses;
CREATE POLICY skill_responses_write_own ON public.skill_assessment_responses
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.skill_assessment_attempts a
     WHERE a.id = attempt_id AND a.player_id = auth.uid() AND a.status = 'in_progress'))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.skill_assessment_attempts a
     WHERE a.id = attempt_id AND a.player_id = auth.uid() AND a.status = 'in_progress'));

DROP POLICY IF EXISTS skill_profiles_select ON public.player_skill_profiles;
CREATE POLICY skill_profiles_select ON public.player_skill_profiles
  FOR SELECT USING (public.can_view_player_skill(player_id));
DROP POLICY IF EXISTS skill_profiles_upsert_own ON public.player_skill_profiles;

DROP POLICY IF EXISTS skill_scores_select ON public.player_skill_scores;
CREATE POLICY skill_scores_select ON public.player_skill_scores
  FOR SELECT USING (player_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS skill_evidence_select_own ON public.skill_evidence;
CREATE POLICY skill_evidence_select_own ON public.skill_evidence
  FOR SELECT USING (player_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS skill_evidence_admin ON public.skill_evidence;
CREATE POLICY skill_evidence_admin ON public.skill_evidence
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS skill_overrides_select ON public.skill_overrides;
CREATE POLICY skill_overrides_select ON public.skill_overrides
  FOR SELECT USING (player_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS skill_overrides_admin ON public.skill_overrides;
CREATE POLICY skill_overrides_admin ON public.skill_overrides
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.skill_assessment_items TO authenticated;
GRANT ALL ON public.skill_assessment_items TO service_role;
GRANT SELECT, DELETE ON public.skill_assessment_attempts TO authenticated;
GRANT INSERT (player_id, assessment_version, assessment_type, status)
  ON public.skill_assessment_attempts TO authenticated;
GRANT UPDATE (last_activity_at)
  ON public.skill_assessment_attempts TO authenticated;
GRANT ALL ON public.skill_assessment_attempts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_assessment_responses TO authenticated;
GRANT ALL ON public.skill_assessment_responses TO service_role;
GRANT SELECT ON public.player_skill_profiles TO authenticated;
GRANT ALL ON public.player_skill_profiles TO service_role;
GRANT SELECT ON public.player_skill_scores TO authenticated;
GRANT ALL ON public.player_skill_scores TO service_role;
GRANT SELECT ON public.skill_evidence TO authenticated;
GRANT ALL ON public.skill_evidence TO service_role;
GRANT SELECT ON public.skill_overrides TO authenticated;
GRANT ALL ON public.skill_overrides TO service_role;

CREATE OR REPLACE FUNCTION public.apply_skill_scoring_snapshot(
  p_attempt_id UUID,
  p_snapshot   JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_is_service BOOLEAN := (COALESCE(auth.role(),'') = 'service_role');
  v_att        public.skill_assessment_attempts%ROWTYPE;
  v_raw   NUMERIC := LEAST( (p_snapshot->>'estimatedLevelRaw')::NUMERIC, 4.7 );
  v_conf  INTEGER := (p_snapshot->'confidence'->>'total')::INTEGER;
  v_rec   JSONB;
BEGIN
  SELECT * INTO v_att FROM public.skill_assessment_attempts WHERE id = p_attempt_id FOR UPDATE;
  IF v_att.id IS NULL THEN RAISE EXCEPTION 'Attempt not found' USING ERRCODE = '02000'; END IF;
  IF NOT v_is_service AND (v_uid IS NULL OR v_att.player_id <> v_uid) THEN
    RAISE EXCEPTION 'Not authorized to finalize this attempt' USING ERRCODE = '42501';
  END IF;
  IF v_att.status = 'completed' THEN RETURN; END IF;

  UPDATE public.skill_assessment_attempts SET
    status                  = 'completed',
    completed_at            = now(),
    scoring_model_version   = (p_snapshot->>'scoringModelVersion')::INTEGER,
    estimated_level_raw     = v_raw,
    estimated_level_display = (p_snapshot->>'estimatedLevelDisplay')::NUMERIC,
    display_band            = p_snapshot->>'displayBand',
    lower_bound             = (p_snapshot->>'lowerBound')::NUMERIC,
    upper_bound             = (p_snapshot->>'upperBound')::NUMERIC,
    confidence_score        = v_conf,
    confidence_label        = p_snapshot->'confidence'->>'label',
    primary_style           = p_snapshot->'primaryStyle'->>'label',
    secondary_style         = p_snapshot->'secondaryStyle'->>'label',
    scoring_snapshot        = p_snapshot
  WHERE id = p_attempt_id;

  DELETE FROM public.player_skill_scores WHERE attempt_id = p_attempt_id;
  FOR v_rec IN SELECT * FROM jsonb_array_elements(COALESCE(p_snapshot->'subskills','[]'::jsonb)) LOOP
    INSERT INTO public.player_skill_scores
      (attempt_id, player_id, score_type, score_key, raw_score, display_score, confidence_score, evidence_count, scoring_details)
    VALUES
      (p_attempt_id, v_uid, 'subskill', v_rec->>'subskill',
       (v_rec->>'rawLevel')::NUMERIC, (v_rec->>'displayLevel')::NUMERIC,
       (v_rec->>'confidence')::INTEGER, (v_rec->>'evidenceCount')::INTEGER, v_rec);
  END LOOP;

  INSERT INTO public.player_skill_profiles
    (player_id, self_assessed_level, self_assessed_band, self_assessed_at, self_assessment_confidence, provisional_status)
  VALUES (v_uid, v_raw, p_snapshot->>'displayBand', now(), v_conf, true)
  ON CONFLICT (player_id) DO UPDATE SET
    self_assessed_level        = EXCLUDED.self_assessed_level,
    self_assessed_band         = EXCLUDED.self_assessed_band,
    self_assessed_at           = EXCLUDED.self_assessed_at,
    self_assessment_confidence = EXCLUDED.self_assessment_confidence,
    updated_at                 = now();

  INSERT INTO public.skill_evidence (player_id, evidence_type, source_id, level_value, confidence_value, submitted_by)
  VALUES (v_uid, 'self_assessment', p_attempt_id, v_raw, v_conf, v_uid);
END; $$;
REVOKE ALL ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_skill_scoring_snapshot(UUID, JSONB) TO service_role;

CREATE OR REPLACE FUNCTION public.get_league_skill_cards(p_league_id UUID)
RETURNS TABLE (
  player_id            UUID,
  self_assessed_level  NUMERIC,
  self_assessed_band   TEXT,
  confidence           INTEGER,
  provisional_status   BOOLEAN,
  preferred_side       TEXT,
  self_assessed_at     TIMESTAMPTZ,
  primary_style        TEXT,
  secondary_style      TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.player_id, p.self_assessed_level, p.self_assessed_band,
           p.self_assessment_confidence, p.provisional_status, p.preferred_side,
           p.self_assessed_at,
           (SELECT a.primary_style FROM public.skill_assessment_attempts a
             WHERE a.player_id = p.player_id AND a.status = 'completed'
             ORDER BY a.completed_at DESC LIMIT 1),
           (SELECT a.secondary_style FROM public.skill_assessment_attempts a
             WHERE a.player_id = p.player_id AND a.status = 'completed'
             ORDER BY a.completed_at DESC LIMIT 1)
      FROM public.player_skill_profiles p
      JOIN public.league_members m ON m.user_id = p.player_id
     WHERE m.league_id = p_league_id
       AND COALESCE(p.visibility, 'organizers') <> 'private';
END; $$;
GRANT EXECUTE ON FUNCTION public.get_league_skill_cards(UUID) TO authenticated;

COMMENT ON TABLE public.player_skill_profiles IS
  'PULSE Self-Assessed Level + Observed Skill summary. Written ONLY by apply_skill_scoring_snapshot (service role) via the skill-complete edge function; client-readable, not client-writable. Separate from profiles.current_rating (Performance Rating), which this never modifies.';