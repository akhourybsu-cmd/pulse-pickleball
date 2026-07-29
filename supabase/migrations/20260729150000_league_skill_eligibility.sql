-- ============================================================================
-- PULSE Skill Assessment — League Eligibility CONFIGURATION (foundation)
--
-- Adds an OPTIONAL, per-league eligibility configuration. It is an inactive
-- foundation: `enabled` defaults false and NOTHING in this migration enforces
-- eligibility on join, generation, or any existing flow. Enforcement + the
-- player-facing surface are deliberately deferred to a later pass so existing
-- leagues are not destabilized and no league is forced to use the assessment.
--
-- Complements (does NOT replace) the advisory leagues.skill_min/skill_max.
-- Does not touch the PULSE Performance Rating, scoring, or the question bank.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.league_skill_eligibility (
  league_id                UUID PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
  -- Master switch for this league. While false (default), eligibility is a
  -- no-op everywhere — the config can be authored without any effect.
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  min_level                NUMERIC(2,1) CHECK (min_level IS NULL OR (min_level >= 1.0 AND min_level <= 6.0)),
  max_level                NUMERIC(2,1) CHECK (max_level IS NULL OR (max_level >= 1.0 AND max_level <= 6.0)),
  accepted_sources         TEXT[] NOT NULL DEFAULT ARRAY['self']::TEXT[],
  accept_self_assessment   BOOLEAN NOT NULL DEFAULT true,
  min_confidence           INTEGER NOT NULL DEFAULT 0 CHECK (min_confidence BETWEEN 0 AND 100),
  allow_organizer_approval BOOLEAN NOT NULL DEFAULT true,
  allow_playing_up         BOOLEAN NOT NULL DEFAULT true,   -- below min, with approval
  allow_playing_down       BOOLEAN NOT NULL DEFAULT true,   -- above max
  provisional_policy       TEXT NOT NULL DEFAULT 'allow' CHECK (provisional_policy IN ('allow','require_review','block')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT league_elig_range_chk CHECK (min_level IS NULL OR max_level IS NULL OR max_level >= min_level)
);

-- Reuse the skill feature's updated_at helper.
DROP TRIGGER IF EXISTS trg_league_skill_eligibility_updated_at ON public.league_skill_eligibility;
CREATE TRIGGER trg_league_skill_eligibility_updated_at
  BEFORE UPDATE ON public.league_skill_eligibility
  FOR EACH ROW EXECUTE FUNCTION public.skill_touch_updated_at();

ALTER TABLE public.league_skill_eligibility ENABLE ROW LEVEL SECURITY;

-- League admins (or system admins) manage their league's config; nobody else
-- can read or write it (no player-facing exposure yet).
DROP POLICY IF EXISTS league_skill_eligibility_admin ON public.league_skill_eligibility;
CREATE POLICY league_skill_eligibility_admin ON public.league_skill_eligibility
  FOR ALL
  USING (public.is_league_admin(league_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT, INSERT, UPDATE ON public.league_skill_eligibility TO authenticated;

COMMENT ON TABLE public.league_skill_eligibility IS
  'Optional per-league skill-eligibility config for the PULSE Skill Assessment. Inactive foundation: enforcement is deferred to a later pass; enabled defaults false.';
