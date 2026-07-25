-- =====================================================================
-- Short weeks — sitting a player out when no sub can be found.
--
-- When a player can't make a week and no substitute fills their slot, the
-- organizer sits them out for THAT week only. They are removed from the
-- week's grouping/play but HOLD their ladder rung, and return automatically
-- next week at the same position (see the excludeSitouts / reinsertSitouts
-- ladder engine helpers + the ladder edge functions).
--
-- The playing count must stay a positive multiple of four (a group of three
-- can't run the 3-game rotation). Sit-outs are chosen BEFORE the week is
-- generated; once a batch exists for the week the roster is locked (the
-- groups + matches already exist — regrouping a live week is out of scope).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.ladder_week_sitouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id    UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  -- The week the player sits out (matches ladder_batches.week_number).
  week_number  INTEGER NOT NULL CHECK (week_number >= 1),
  player_id    UUID NOT NULL REFERENCES public.profiles(id),
  note         TEXT,
  created_by   UUID REFERENCES public.profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (season_id, week_number, player_id)
);
CREATE INDEX IF NOT EXISTS idx_ladder_week_sitouts_week
  ON public.ladder_week_sitouts(season_id, week_number);

ALTER TABLE public.ladder_week_sitouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League admins full access" ON public.ladder_week_sitouts;
CREATE POLICY "League admins full access" ON public.ladder_week_sitouts
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

-- Members can read who is sitting out (so a player can see "you're sitting
-- out week N"). Not sensitive.
DROP POLICY IF EXISTS "Members read sitouts of own leagues" ON public.ladder_week_sitouts;
CREATE POLICY "Members read sitouts of own leagues" ON public.ladder_week_sitouts
  FOR SELECT USING (public.player_can_view_league(league_id));

-- Toggle a player's sit-out for a week. p_sitting = true inserts, false
-- removes. Admin-gated; refuses once the week has been generated.
CREATE OR REPLACE FUNCTION public.set_ladder_week_sitout(
  p_season_id   UUID,
  p_week_number INTEGER,
  p_player_id   UUID,
  p_sitting     BOOLEAN,
  p_note        TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user      UUID := auth.uid();
  v_league_id UUID;
  v_is_mem    BOOLEAN;
  v_count     INTEGER;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;
  IF p_week_number IS NULL OR p_week_number < 1 THEN
    RAISE EXCEPTION 'A valid week number is required' USING ERRCODE = '22023';
  END IF;

  SELECT league_id INTO v_league_id FROM public.league_seasons WHERE id = p_season_id;
  IF v_league_id IS NULL THEN
    RAISE EXCEPTION 'Season not found' USING ERRCODE = '02000';
  END IF;
  IF NOT public.is_league_admin(v_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;

  -- Roster is locked once the week's batch exists.
  IF EXISTS (
    SELECT 1 FROM public.ladder_batches
     WHERE season_id = p_season_id AND week_number = p_week_number
  ) THEN
    RAISE EXCEPTION 'Week % is already generated — its roster is locked', p_week_number
      USING ERRCODE = '22023';
  END IF;

  IF p_sitting THEN
    SELECT EXISTS (
      SELECT 1 FROM public.league_members
       WHERE league_id = v_league_id AND season_id = p_season_id
         AND user_id = p_player_id AND status = 'active'
    ) INTO v_is_mem;
    IF NOT v_is_mem THEN
      RAISE EXCEPTION 'Only an active member of this season can be sat out'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.ladder_week_sitouts
      (league_id, season_id, week_number, player_id, note, created_by)
    VALUES (v_league_id, p_season_id, p_week_number, p_player_id,
            NULLIF(TRIM(COALESCE(p_note, '')), ''), v_user)
    ON CONFLICT (season_id, week_number, player_id) DO UPDATE
      SET note = EXCLUDED.note;
  ELSE
    DELETE FROM public.ladder_week_sitouts
     WHERE season_id = p_season_id AND week_number = p_week_number
       AND player_id = p_player_id;
  END IF;

  SELECT count(*) INTO v_count FROM public.ladder_week_sitouts
   WHERE season_id = p_season_id AND week_number = p_week_number;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_league_id, p_season_id, v_user,
    CASE WHEN p_sitting THEN 'ladder.player_sat_out' ELSE 'ladder.player_unsat' END,
    'league_season', p_season_id,
    jsonb_build_object('week', p_week_number, 'player_id', p_player_id,
                       'sitting', p_sitting, 'sitout_count', v_count)
  );

  RETURN jsonb_build_object('week_number', p_week_number, 'sitout_count', v_count,
                            'sitting', p_sitting);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_ladder_week_sitout(UUID, INTEGER, UUID, BOOLEAN, TEXT)
  TO authenticated;
