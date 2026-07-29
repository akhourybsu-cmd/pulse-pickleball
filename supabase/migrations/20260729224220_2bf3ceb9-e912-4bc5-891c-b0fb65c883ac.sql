CREATE TABLE IF NOT EXISTS public.league_skill_eligibility (
  league_id                UUID PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  min_level                NUMERIC(2,1) CHECK (min_level IS NULL OR (min_level >= 1.0 AND min_level <= 6.0)),
  max_level                NUMERIC(2,1) CHECK (max_level IS NULL OR (max_level >= 1.0 AND max_level <= 6.0)),
  accepted_sources         TEXT[] NOT NULL DEFAULT ARRAY['self']::TEXT[],
  accept_self_assessment   BOOLEAN NOT NULL DEFAULT true,
  min_confidence           INTEGER NOT NULL DEFAULT 0 CHECK (min_confidence BETWEEN 0 AND 100),
  allow_organizer_approval BOOLEAN NOT NULL DEFAULT true,
  allow_playing_up         BOOLEAN NOT NULL DEFAULT true,
  allow_playing_down       BOOLEAN NOT NULL DEFAULT true,
  provisional_policy       TEXT NOT NULL DEFAULT 'allow' CHECK (provisional_policy IN ('allow','require_review','block')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT league_elig_range_chk CHECK (min_level IS NULL OR max_level IS NULL OR max_level >= min_level)
);

DROP TRIGGER IF EXISTS trg_league_skill_eligibility_updated_at ON public.league_skill_eligibility;
CREATE TRIGGER trg_league_skill_eligibility_updated_at
  BEFORE UPDATE ON public.league_skill_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();

ALTER TABLE public.league_skill_eligibility ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS league_skill_eligibility_admin ON public.league_skill_eligibility;
CREATE POLICY league_skill_eligibility_admin ON public.league_skill_eligibility
  FOR ALL
  USING (public.is_league_admin(league_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.league_skill_eligibility TO authenticated;
GRANT ALL ON public.league_skill_eligibility TO service_role;

COMMENT ON TABLE public.league_skill_eligibility IS
  'Optional per-league skill-eligibility config for the PULSE Skill Assessment. Inactive foundation: enforcement is deferred to a later pass; enabled defaults false.';