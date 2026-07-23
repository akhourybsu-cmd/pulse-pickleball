CREATE TABLE IF NOT EXISTS public.ladder_tiebreaks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id        UUID NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  season_id        UUID NOT NULL REFERENCES public.league_seasons(id) ON DELETE CASCADE,
  batch_id         UUID NOT NULL REFERENCES public.ladder_batches(id) ON DELETE CASCADE,
  group_id         UUID NOT NULL REFERENCES public.ladder_batch_groups(id) ON DELETE CASCADE,
  court_number     INTEGER,
  tied_player_ids  UUID[] NOT NULL,
  boundaries       TEXT[] NOT NULL DEFAULT '{}',
  resolved_order   UUID[],
  resolved_by      UUID REFERENCES public.profiles(id),
  resolved_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, group_id)
);

GRANT SELECT ON public.ladder_tiebreaks TO authenticated;
GRANT ALL ON public.ladder_tiebreaks TO service_role;

CREATE INDEX IF NOT EXISTS idx_ladder_tiebreaks_league ON public.ladder_tiebreaks(league_id);
CREATE INDEX IF NOT EXISTS idx_ladder_tiebreaks_batch ON public.ladder_tiebreaks(batch_id);

CREATE OR REPLACE FUNCTION public.player_is_in_ladder_group(p_group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_matches lm
     WHERE lm.ladder_batch_group_id = p_group_id
       AND auth.uid() IN (lm.player_a_id, lm.player_b_id, lm.player_c_id, lm.player_d_id)
  );
$$;
GRANT EXECUTE ON FUNCTION public.player_is_in_ladder_group(UUID) TO authenticated;

ALTER TABLE public.ladder_tiebreaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "League admins full access" ON public.ladder_tiebreaks;
CREATE POLICY "League admins full access" ON public.ladder_tiebreaks
  FOR ALL USING (public.is_league_admin(league_id, auth.uid()))
  WITH CHECK (public.is_league_admin(league_id, auth.uid()));

DROP POLICY IF EXISTS "Participants read their tiebreak" ON public.ladder_tiebreaks;
CREATE POLICY "Participants read their tiebreak" ON public.ladder_tiebreaks
  FOR SELECT USING (public.player_is_in_ladder_group(group_id));

CREATE OR REPLACE FUNCTION public.record_ladder_tiebreak(
  p_group_id    UUID,
  p_ordered_ids UUID[]
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  UUID := auth.uid();
  v_row   RECORD;
  v_batch RECORD;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_row FROM public.ladder_tiebreaks
   WHERE group_id = p_group_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No tiebreak is pending for this court' USING ERRCODE = '02000';
  END IF;

  IF NOT (public.is_league_admin(v_row.league_id, v_user)
          OR public.player_is_in_ladder_group(p_group_id)) THEN
    RAISE EXCEPTION 'Only players on this court can record the tiebreak'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_batch FROM public.ladder_batches WHERE id = v_row.batch_id;
  IF v_batch.status = 'finalized' THEN
    RAISE EXCEPTION 'This batch has already been processed' USING ERRCODE = '22023';
  END IF;

  IF p_ordered_ids IS NULL
     OR array_length(p_ordered_ids, 1) IS DISTINCT FROM array_length(v_row.tied_player_ids, 1)
     OR EXISTS (SELECT 1 FROM (
          SELECT unnest(p_ordered_ids) EXCEPT SELECT unnest(v_row.tied_player_ids)) a)
     OR EXISTS (SELECT 1 FROM (
          SELECT unnest(v_row.tied_player_ids) EXCEPT SELECT unnest(p_ordered_ids)) b)
  THEN
    RAISE EXCEPTION 'The order must rank exactly the tied players'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.ladder_tiebreaks
     SET resolved_order = p_ordered_ids,
         resolved_by = v_user,
         resolved_at = now()
   WHERE id = v_row.id;

  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (
    v_row.league_id, v_row.season_id, v_user,
    'ladder.tiebreak_recorded', 'ladder_batch', v_row.batch_id,
    jsonb_build_object('group_id', p_group_id, 'order', to_jsonb(p_ordered_ids))
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_ladder_tiebreak(UUID, UUID[]) TO authenticated;

COMMENT ON TABLE public.ladder_tiebreaks IS
  'One row per court that ends in a movement-deciding tie.';