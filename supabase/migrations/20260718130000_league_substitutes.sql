-- =====================================================================
-- League substitutes — a season-scoped sub pool + a swap-in RPC
--
-- Organizers keep a list of substitutes (fill-in players not on a fixed
-- team roster) and swap one into any match for a given week when a
-- regular can't make it.
--
-- Model:
--   • league_substitutes: the maintained sub list, scoped to a season
--     (like members/teams). Carries an optional preferred division and
--     free-text notes so the organizer can "track" each sub
--     (availability, contact preference, etc.).
--   • swap_league_match_player(): swaps a single individual player slot
--     (a/b/c/d) on a match to another player, validated + audited. The
--     new player must be an active sub OR an active member of the same
--     season, so a swap always maps to a real, known participant.
--
-- Access mirrors the rest of League Play: is_league_admin(league_id)
-- (owner OR platform admin) has full control. Subs never touch the
-- rating engine — league_matches stay rating_status='not_connected'.
-- =====================================================================

-- ---------- 1. league_substitutes ---------------------------------------
CREATE TABLE IF NOT EXISTS public.league_substitutes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id   UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id   UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  division_id UUID REFERENCES public.league_divisions(id) ON DELETE SET NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (league_id, season_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_league_substitutes_season
  ON public.league_substitutes(season_id);
CREATE INDEX IF NOT EXISTS idx_league_substitutes_user
  ON public.league_substitutes(user_id);

-- ---------- 2. RLS — league admins full access --------------------------
ALTER TABLE public.league_substitutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "League admins full access" ON public.league_substitutes;
CREATE POLICY "League admins full access" ON public.league_substitutes
  FOR ALL
  USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

-- Let a substitute see their own entry (read-only) so a future player
-- surface can show "you're a sub for this season."
DROP POLICY IF EXISTS "Subs can read own entry" ON public.league_substitutes;
CREATE POLICY "Subs can read own entry" ON public.league_substitutes
  FOR SELECT
  USING (user_id = auth.uid());

-- ---------- 3. updated_at trigger ---------------------------------------
DROP TRIGGER IF EXISTS trg_league_substitutes_updated_at ON public.league_substitutes;
CREATE TRIGGER trg_league_substitutes_updated_at
  BEFORE UPDATE ON public.league_substitutes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- 4. swap_league_match_player RPC -----------------------------
-- Swap one individual player slot on a match. Slot is validated against a
-- fixed whitelist and written via explicit per-slot UPDATEs (no dynamic
-- SQL). The incoming player must be an active sub OR active member of the
-- match's season. Records the old→new swap in the audit log.
CREATE OR REPLACE FUNCTION public.swap_league_match_player(
  p_match_id      UUID,
  p_slot          TEXT,
  p_new_player_id UUID,
  p_note          TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user   UUID := auth.uid();
  v_match  RECORD;
  v_old    UUID;
  v_is_sub BOOLEAN;
  v_is_mem BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_slot NOT IN ('a', 'b', 'c', 'd') THEN
    RAISE EXCEPTION 'Slot must be a, b, c or d' USING ERRCODE = '22023';
  END IF;
  IF p_new_player_id IS NULL THEN
    RAISE EXCEPTION 'A replacement player is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_match
    FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN
    RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_match.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- The replacement must be a known participant of this season.
  SELECT EXISTS (
    SELECT 1 FROM public.league_substitutes s
     WHERE s.league_id = v_match.league_id
       AND s.season_id = v_match.season_id
       AND s.user_id   = p_new_player_id
       AND s.status    = 'active'
  ) INTO v_is_sub;
  SELECT EXISTS (
    SELECT 1 FROM public.league_members m
     WHERE m.league_id = v_match.league_id
       AND m.season_id = v_match.season_id
       AND m.user_id   = p_new_player_id
       AND m.status    = 'active'
  ) INTO v_is_mem;
  IF NOT v_is_sub AND NOT v_is_mem THEN
    RAISE EXCEPTION
      'Replacement must be an active substitute or member of this season'
      USING ERRCODE = '22023';
  END IF;

  -- Capture the outgoing occupant and write the new one.
  IF p_slot = 'a' THEN
    v_old := v_match.player_a_id;
    UPDATE public.league_matches
       SET player_a_id = p_new_player_id, updated_at = NOW()
     WHERE id = p_match_id;
  ELSIF p_slot = 'b' THEN
    v_old := v_match.player_b_id;
    UPDATE public.league_matches
       SET player_b_id = p_new_player_id, updated_at = NOW()
     WHERE id = p_match_id;
  ELSIF p_slot = 'c' THEN
    v_old := v_match.player_c_id;
    UPDATE public.league_matches
       SET player_c_id = p_new_player_id, updated_at = NOW()
     WHERE id = p_match_id;
  ELSE
    v_old := v_match.player_d_id;
    UPDATE public.league_matches
       SET player_d_id = p_new_player_id, updated_at = NOW()
     WHERE id = p_match_id;
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id,
     old_value, new_value)
  VALUES (
    v_match.league_id, v_match.season_id, v_user,
    'match.player_swapped', 'league_match', p_match_id,
    jsonb_build_object('slot', p_slot, 'player_id', v_old),
    jsonb_build_object(
      'slot', p_slot,
      'player_id', p_new_player_id,
      'was_substitute', v_is_sub,
      'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_league_match_player(UUID, TEXT, UUID, TEXT)
  TO authenticated;

COMMENT ON FUNCTION public.swap_league_match_player IS
  'League-admin only. Swaps one individual player slot (a/b/c/d) on a '
  'league match to another active sub or member of the same season, and '
  'records the change in the league audit log.';

COMMENT ON TABLE public.league_substitutes IS
  'Season-scoped substitute pool for a league. Fill-in players the '
  'organizer can swap into any match via swap_league_match_player().';
