-- =====================================================================
-- Weekly, individual-player substitutions
--
-- The old flow swapped ONE team slot in ONE match. Leagues are now
-- individual (no teams), and in a doubles ladder a player has several games
-- a week, so a substitution should be per-PLAYER, per-WEEK: drop a sub into
-- every upcoming game the absent player is in, in one action.
--
-- With explicit ladder progression only the CURRENT batch's games are
-- 'scheduled' at any time, so "all of this player's upcoming games" is
-- exactly "this week" — no session bookkeeping needed.
--
-- Stand-in model: the sub plays and enters scores, but the ABSENT REGULAR
-- keeps their ladder identity. league_match_substitutions records
-- (match, slot) -> original player so the ladder engine can credit the
-- regular for the week's result (see the ladder edge functions).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.league_match_substitutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id      UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id      UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  match_id       UUID NOT NULL REFERENCES public.league_matches(id) ON DELETE CASCADE,
  slot           TEXT NOT NULL CHECK (slot IN ('a','b','c','d')),
  -- The player who normally holds this slot (their ladder identity).
  out_player_id  UUID NOT NULL REFERENCES public.profiles(id),
  -- Who is actually playing it this week.
  in_player_id   UUID NOT NULL REFERENCES public.profiles(id),
  note           TEXT,
  created_by     UUID REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (match_id, slot)
);
CREATE INDEX IF NOT EXISTS idx_league_match_subs_match ON public.league_match_substitutions(match_id);
CREATE INDEX IF NOT EXISTS idx_league_match_subs_season ON public.league_match_substitutions(season_id);

ALTER TABLE public.league_match_substitutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "League admins full access" ON public.league_match_substitutions;
CREATE POLICY "League admins full access" ON public.league_match_substitutions
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

-- Replace an absent player with a fill-in across ALL their upcoming
-- (scheduled / in-progress) games in a season, in one call.
CREATE OR REPLACE FUNCTION public.swap_league_week_player(
  p_league_id      UUID,
  p_season_id      UUID,
  p_out_player_id  UUID,
  p_in_player_id   UUID,
  p_note           TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    UUID := auth.uid();
  v_is_sub  BOOLEAN;
  v_is_mem  BOOLEAN;
  v_m       RECORD;
  v_count   INT := 0;
  v_slot    TEXT;
  v_orig    UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF p_out_player_id IS NULL OR p_in_player_id IS NULL THEN
    RAISE EXCEPTION 'Both players are required' USING ERRCODE = '22023';
  END IF;
  IF p_out_player_id = p_in_player_id THEN
    RAISE EXCEPTION 'Pick a different fill-in player' USING ERRCODE = '22023';
  END IF;

  -- The fill-in must be an active sub or member of this season.
  SELECT EXISTS (SELECT 1 FROM public.league_substitutes s
     WHERE s.league_id = p_league_id AND s.season_id = p_season_id
       AND s.user_id = p_in_player_id AND s.status = 'active') INTO v_is_sub;
  SELECT EXISTS (SELECT 1 FROM public.league_members m
     WHERE m.league_id = p_league_id AND m.season_id = p_season_id
       AND m.user_id = p_in_player_id AND m.status = 'active') INTO v_is_mem;
  IF NOT v_is_sub AND NOT v_is_mem THEN
    RAISE EXCEPTION 'The fill-in must be an active substitute or member of this season'
      USING ERRCODE = '22023';
  END IF;

  FOR v_m IN
    SELECT * FROM public.league_matches
     WHERE league_id = p_league_id AND season_id = p_season_id
       AND status IN ('scheduled', 'in_progress')
       AND p_out_player_id IN (player_a_id, player_b_id, player_c_id, player_d_id)
     FOR UPDATE
  LOOP
    -- The fill-in can't already be in this match (would duplicate a player).
    IF p_in_player_id IN (v_m.player_a_id, v_m.player_b_id, v_m.player_c_id, v_m.player_d_id) THEN
      RAISE EXCEPTION 'That player is already in one of these games — pick another fill-in'
        USING ERRCODE = '22023';
    END IF;

    v_slot := CASE p_out_player_id
      WHEN v_m.player_a_id THEN 'a' WHEN v_m.player_b_id THEN 'b'
      WHEN v_m.player_c_id THEN 'c' ELSE 'd' END;

    IF v_slot = 'a' THEN
      UPDATE public.league_matches SET player_a_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'b' THEN
      UPDATE public.league_matches SET player_b_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSIF v_slot = 'c' THEN
      UPDATE public.league_matches SET player_c_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    ELSE
      UPDATE public.league_matches SET player_d_id = p_in_player_id, updated_at = now() WHERE id = v_m.id;
    END IF;

    -- Track the ladder identity for this slot. If an earlier sub already
    -- holds it, keep the TRUE original; if we're restoring the original,
    -- drop the mapping.
    SELECT out_player_id INTO v_orig FROM public.league_match_substitutions
     WHERE match_id = v_m.id AND slot = v_slot;
    v_orig := COALESCE(v_orig, p_out_player_id);

    IF p_in_player_id = v_orig THEN
      DELETE FROM public.league_match_substitutions WHERE match_id = v_m.id AND slot = v_slot;
    ELSE
      INSERT INTO public.league_match_substitutions
        (league_id, season_id, match_id, slot, out_player_id, in_player_id, note, created_by)
      VALUES (p_league_id, p_season_id, v_m.id, v_slot, v_orig, p_in_player_id,
              NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
      ON CONFLICT (match_id, slot) DO UPDATE
        SET in_player_id = EXCLUDED.in_player_id,
            out_player_id = EXCLUDED.out_player_id,
            note = EXCLUDED.note, updated_at = now();
    END IF;

    v_count := v_count + 1;
  END LOOP;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'That player has no upcoming games to fill in for' USING ERRCODE = '02000';
  END IF;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    p_league_id, p_season_id, v_user, 'league.week_player_swapped', 'league_season', p_season_id,
    jsonb_build_object('out_player_id', p_out_player_id, 'in_player_id', p_in_player_id,
                       'was_substitute', v_is_sub, 'games', v_count,
                       'note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)'))
  );

  RETURN jsonb_build_object('matches_updated', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.swap_league_week_player(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.swap_league_week_player IS
  'League-admin only. Replaces a player with an active sub/member across all '
  'their upcoming (scheduled/in-progress) games in a season at once, and '
  'records the (match,slot)->original mapping so ladder ranking still credits '
  'the absent regular (stand-in model).';
