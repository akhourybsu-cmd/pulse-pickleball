-- =====================================================================
-- Self-serve league ownership + create RPC (bundled with paid slots)
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_league_admin(
  p_league_id UUID,
  p_user_id   UUID DEFAULT auth.uid()
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL
    AND (
      public.has_role(p_user_id, 'admin'::app_role)
      OR EXISTS (
        SELECT 1 FROM public.leagues
         WHERE id = p_league_id AND created_by = p_user_id
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_league_admin(UUID, UUID) TO authenticated;

COMMENT ON FUNCTION public.is_league_admin IS
  'TRUE when the user is EITHER a platform admin OR the leagues.created_by of the referenced league.';

-- Refresh RLS policies for league tables that carry league_id directly.
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leagues', 'league_seasons', 'league_divisions', 'league_members',
    'league_teams', 'league_sessions', 'league_matches', 'league_audit_log'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "League admins full access" ON public.%I', t);
    IF t = 'leagues' THEN
      EXECUTE format(
        'CREATE POLICY "League admins full access" ON public.%I FOR ALL '
        'USING (public.is_league_admin(id, auth.uid())) '
        'WITH CHECK (public.is_league_admin(id, auth.uid()) OR created_by = auth.uid())',
        t);
    ELSE
      EXECUTE format(
        'CREATE POLICY "League admins full access" ON public.%I FOR ALL '
        'USING (public.is_league_admin(league_id, auth.uid())) '
        'WITH CHECK (public.is_league_admin(league_id, auth.uid()))',
        t);
    END IF;
  END LOOP;
END $$;

-- league_team_members has no league_id column; resolve via parent team.
DROP POLICY IF EXISTS "Admins full access" ON public.league_team_members;
DROP POLICY IF EXISTS "League admins full access" ON public.league_team_members;
CREATE POLICY "League admins full access" ON public.league_team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.league_teams lt
       WHERE lt.id = league_team_members.team_id
         AND public.is_league_admin(lt.league_id, auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.league_teams lt
       WHERE lt.id = league_team_members.team_id
         AND public.is_league_admin(lt.league_id, auth.uid())
    )
  );


CREATE OR REPLACE FUNCTION public.log_league_action(
  p_league_id UUID, p_season_id UUID, p_action TEXT,
  p_entity_type TEXT, p_entity_id UUID,
  p_old_value JSONB DEFAULT NULL, p_new_value JSONB DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_actor UUID := auth.uid(); v_id UUID;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_league_admin(p_league_id, v_actor) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.league_audit_log
    (league_id, season_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (p_league_id, p_season_id, v_actor, p_action, p_entity_type, p_entity_id, p_old_value, p_new_value)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;


CREATE OR REPLACE FUNCTION public.resolve_league_match_dispute(
  p_match_id UUID, p_team_a_score INTEGER, p_team_b_score INTEGER, p_note TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_match RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF p_team_a_score IS NULL OR p_team_b_score IS NULL OR p_team_a_score < 0 OR p_team_b_score < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative integers' USING ERRCODE = '22023';
  END IF;
  IF p_team_a_score = p_team_b_score THEN
    RAISE EXCEPTION 'Pickleball scores cannot be tied' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  IF NOT public.is_league_admin(v_match.league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF v_match.status NOT IN ('disputed', 'score_submitted', 'forfeit') THEN
    RAISE EXCEPTION 'Match is not in a resolvable state (status: %)', v_match.status USING ERRCODE = '22023';
  END IF;
  UPDATE public.league_matches
     SET team_a_score = p_team_a_score, team_b_score = p_team_b_score,
         status = 'verified', verified_by = ARRAY[v_user]::UUID[],
         dispute_reason = NULL, forfeit_winner_team_id = NULL, updated_at = NOW()
   WHERE id = p_match_id;
  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_match.league_id, v_user, 'match.dispute_resolved', 'league_match', p_match_id,
    jsonb_build_object('previous_status', v_match.status, 'previous_a', v_match.team_a_score,
      'previous_b', v_match.team_b_score, 'previous_reason', v_match.dispute_reason,
      'previous_forfeit_winner', v_match.forfeit_winner_team_id),
    jsonb_build_object('team_a_score', p_team_a_score, 'team_b_score', p_team_b_score,
      'admin_note', COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), '(none)')));
END; $$;


CREATE OR REPLACE FUNCTION public.forfeit_league_match(
  p_match_id UUID, p_winner_team_id UUID DEFAULT NULL, p_reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_match RECORD;
  v_is_admin BOOLEAN; v_is_captain_a BOOLEAN; v_is_captain_b BOOLEAN; v_winner_team UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_match FROM public.league_matches WHERE id = p_match_id FOR UPDATE;
  IF v_match.id IS NULL THEN RAISE EXCEPTION 'Match not found' USING ERRCODE = '02000'; END IF;
  IF v_match.status IN ('verified', 'forfeit', 'canceled') THEN
    RAISE EXCEPTION 'Match is already % — cannot forfeit', v_match.status USING ERRCODE = '22023';
  END IF;
  IF v_match.team_a_id IS NULL OR v_match.team_b_id IS NULL THEN
    RAISE EXCEPTION 'Both teams must be set to record a forfeit' USING ERRCODE = '22023';
  END IF;
  v_is_admin := public.is_league_admin(v_match.league_id, v_user);
  v_is_captain_a := EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id = v_match.team_a_id AND t.captain_user_id = v_user);
  v_is_captain_b := EXISTS (SELECT 1 FROM public.league_teams t WHERE t.id = v_match.team_b_id AND t.captain_user_id = v_user);
  IF NOT v_is_admin AND NOT v_is_captain_a AND NOT v_is_captain_b THEN
    RAISE EXCEPTION 'Only a league admin or the captain of a participating team can forfeit' USING ERRCODE = '42501';
  END IF;
  IF v_is_admin THEN
    IF p_winner_team_id IS NULL THEN
      RAISE EXCEPTION 'Admins must specify the winning team id when calling forfeit' USING ERRCODE = '22023';
    END IF;
    IF p_winner_team_id NOT IN (v_match.team_a_id, v_match.team_b_id) THEN
      RAISE EXCEPTION 'Winning team must be team_a or team_b of this match' USING ERRCODE = '22023';
    END IF;
    v_winner_team := p_winner_team_id;
  ELSIF v_is_captain_a THEN v_winner_team := v_match.team_b_id;
  ELSE v_winner_team := v_match.team_a_id;
  END IF;
  UPDATE public.league_matches
     SET status = 'forfeit', forfeit_winner_team_id = v_winner_team,
         team_a_score = NULL, team_b_score = NULL, verified_by = ARRAY[]::UUID[],
         dispute_reason = NULLIF(TRIM(COALESCE(p_reason, '')), ''),
         score_submitted_by = NULL, score_submitted_at = NULL, updated_at = NOW()
   WHERE id = p_match_id;
  INSERT INTO public.league_audit_log
    (league_id, actor_user_id, action, entity_type, entity_id, old_value, new_value)
  VALUES (v_match.league_id, v_user, 'match.forfeited', 'league_match', p_match_id,
    jsonb_build_object('previous_status', v_match.status, 'previous_a', v_match.team_a_score, 'previous_b', v_match.team_b_score),
    jsonb_build_object('winner_team_id', v_winner_team,
      'source', CASE WHEN v_is_admin THEN 'admin' ELSE 'captain' END,
      'reason', COALESCE(NULLIF(TRIM(COALESCE(p_reason, '')), ''), '(none)')));
END; $$;


CREATE OR REPLACE FUNCTION public.sync_league_season_statuses(p_league_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_today DATE := CURRENT_DATE;
  v_activated INT := 0; v_completed INT := 0;
  v_ids_activated UUID[]; v_ids_completed UUID[];
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  WITH updated AS (
    UPDATE public.league_seasons SET status = 'active', updated_at = NOW()
     WHERE league_id = p_league_id AND status = 'draft'
       AND start_date IS NOT NULL AND start_date <= v_today
       AND (end_date IS NULL OR end_date >= v_today) RETURNING id)
  SELECT array_agg(id), count(*) INTO v_ids_activated, v_activated FROM updated;
  WITH updated AS (
    UPDATE public.league_seasons SET status = 'completed', updated_at = NOW()
     WHERE league_id = p_league_id AND status = 'active'
       AND end_date IS NOT NULL AND end_date < v_today RETURNING id)
  SELECT array_agg(id), count(*) INTO v_ids_completed, v_completed FROM updated;
  IF v_activated > 0 OR v_completed > 0 THEN
    INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (p_league_id, v_user, 'season.lifecycle_synced', 'league', p_league_id,
      jsonb_build_object('activated_count', v_activated, 'completed_count', v_completed,
        'activated_ids', COALESCE(v_ids_activated, ARRAY[]::UUID[]),
        'completed_ids', COALESCE(v_ids_completed, ARRAY[]::UUID[])));
  END IF;
  RETURN jsonb_build_object('activated', v_activated, 'completed', v_completed);
END; $$;


CREATE OR REPLACE FUNCTION public.bulk_add_league_members(
  p_league_id UUID, p_season_id UUID DEFAULT NULL, p_division_id UUID DEFAULT NULL,
  p_emails TEXT[] DEFAULT ARRAY[]::TEXT[], p_dry_run BOOLEAN DEFAULT TRUE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_email TEXT; v_norm TEXT; v_profile RECORD;
  v_existing UUID; v_new_mem UUID;
  v_resolved JSONB := '[]'::JSONB; v_unmatched TEXT[] := ARRAY[]::TEXT[];
  v_added_count INT := 0; v_reactivated_count INT := 0; v_already_count INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_league_admin(p_league_id, v_user) THEN
    RAISE EXCEPTION 'League admin privileges required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leagues WHERE id = p_league_id) THEN
    RAISE EXCEPTION 'League not found' USING ERRCODE = '02000';
  END IF;
  IF p_season_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.league_seasons WHERE id = p_season_id AND league_id = p_league_id) THEN
    RAISE EXCEPTION 'Season does not belong to this league' USING ERRCODE = '22023';
  END IF;
  IF p_division_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.league_divisions WHERE id = p_division_id AND league_id = p_league_id) THEN
    RAISE EXCEPTION 'Division does not belong to this league' USING ERRCODE = '22023';
  END IF;
  IF p_emails IS NULL OR array_length(p_emails, 1) IS NULL THEN
    RETURN jsonb_build_object('resolved', v_resolved, 'unmatched', v_unmatched,
      'added_count', 0, 'reactivated_count', 0, 'already_active_count', 0, 'dry_run', p_dry_run);
  END IF;
  FOREACH v_email IN ARRAY p_emails LOOP
    v_norm := lower(trim(v_email));
    IF v_norm = '' THEN CONTINUE; END IF;
    SELECT id, COALESCE(display_name, full_name, email) AS name, email INTO v_profile
      FROM public.profiles WHERE lower(email) = v_norm LIMIT 1;
    IF v_profile.id IS NULL THEN
      v_unmatched := array_append(v_unmatched, v_email); CONTINUE;
    END IF;
    SELECT id INTO v_existing FROM public.league_members
     WHERE league_id = p_league_id AND user_id = v_profile.id
       AND ((p_season_id IS NOT NULL AND season_id = p_season_id) OR (p_season_id IS NULL AND season_id IS NULL))
     LIMIT 1;
    IF v_existing IS NOT NULL THEN
      DECLARE v_status TEXT;
      BEGIN
        SELECT status INTO v_status FROM public.league_members WHERE id = v_existing;
        IF v_status = 'active' THEN
          v_already_count := v_already_count + 1;
          v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'already_active');
        ELSE
          IF NOT p_dry_run THEN
            UPDATE public.league_members SET status = 'active',
              division_id = COALESCE(p_division_id, division_id), updated_at = NOW()
             WHERE id = v_existing;
          END IF;
          v_reactivated_count := v_reactivated_count + 1;
          v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'reactivated');
        END IF;
      END;
    ELSE
      IF NOT p_dry_run THEN
        INSERT INTO public.league_members (league_id, season_id, division_id, user_id, role, status)
        VALUES (p_league_id, p_season_id, p_division_id, v_profile.id, 'player', 'active')
        RETURNING id INTO v_new_mem;
      END IF;
      v_added_count := v_added_count + 1;
      v_resolved := v_resolved || jsonb_build_object('email', v_email, 'user_id', v_profile.id, 'name', v_profile.name, 'outcome', 'added');
    END IF;
  END LOOP;
  IF NOT p_dry_run AND (v_added_count > 0 OR v_reactivated_count > 0) THEN
    INSERT INTO public.league_audit_log (league_id, season_id, actor_user_id, action, entity_type, entity_id, new_value)
    VALUES (p_league_id, p_season_id, v_user, 'members.bulk_added', 'league_members', p_league_id,
      jsonb_build_object('added_count', v_added_count, 'reactivated_count', v_reactivated_count,
        'already_active_count', v_already_count,
        'unmatched_count', COALESCE(array_length(v_unmatched, 1), 0),
        'division_id', p_division_id));
  END IF;
  RETURN jsonb_build_object('resolved', v_resolved, 'unmatched', v_unmatched,
    'added_count', v_added_count, 'reactivated_count', v_reactivated_count,
    'already_active_count', v_already_count, 'dry_run', p_dry_run);
END; $$;


CREATE OR REPLACE FUNCTION public.get_league_season_aggregates(p_league_id UUID)
RETURNS TABLE (season_id UUID, matches INT, verified INT, awaiting_confirm INT,
  pending INT, disputed INT, forfeits INT, members INT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH allowed AS (SELECT id FROM public.league_seasons WHERE league_id = p_league_id),
  match_counts AS (
    SELECT lm.season_id, COUNT(*)::INT AS matches,
      COUNT(*) FILTER (WHERE lm.status = 'verified')::INT AS verified,
      COUNT(*) FILTER (WHERE lm.status = 'score_submitted')::INT AS awaiting_confirm,
      COUNT(*) FILTER (WHERE lm.status IN ('scheduled', 'in_progress'))::INT AS pending,
      COUNT(*) FILTER (WHERE lm.status = 'disputed')::INT AS disputed,
      COUNT(*) FILTER (WHERE lm.status = 'forfeit')::INT AS forfeits
    FROM public.league_matches lm
    WHERE lm.league_id = p_league_id AND lm.season_id IN (SELECT id FROM allowed)
    GROUP BY lm.season_id),
  member_counts AS (
    SELECT m.season_id, COUNT(*)::INT AS members FROM public.league_members m
    WHERE m.league_id = p_league_id AND m.status = 'active'
      AND m.season_id IN (SELECT id FROM allowed) GROUP BY m.season_id)
  SELECT a.id, COALESCE(mc.matches, 0), COALESCE(mc.verified, 0),
    COALESCE(mc.awaiting_confirm, 0), COALESCE(mc.pending, 0),
    COALESCE(mc.disputed, 0), COALESCE(mc.forfeits, 0), COALESCE(memc.members, 0)
  FROM allowed a
  LEFT JOIN match_counts mc ON mc.season_id = a.id
  LEFT JOIN member_counts memc ON memc.season_id = a.id
  WHERE public.is_league_admin(p_league_id, auth.uid());
$$;


-- =====================================================================
-- Freemium: additional league slots via one-time purchase
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS additional_league_slots INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.profiles.additional_league_slots IS
  'Purchased extra league-creation slots.';

CREATE TABLE IF NOT EXISTS public.league_slot_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  stripe_session_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  amount_cents INT,
  currency TEXT DEFAULT 'usd',
  slots_granted INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_league_slot_purchases_user
  ON public.league_slot_purchases(user_id);

GRANT SELECT ON public.league_slot_purchases TO authenticated;
GRANT ALL ON public.league_slot_purchases TO service_role;

ALTER TABLE public.league_slot_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own slot purchases" ON public.league_slot_purchases;
CREATE POLICY "Users can view own slot purchases" ON public.league_slot_purchases
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins full access to slot purchases" ON public.league_slot_purchases;
CREATE POLICY "Admins full access to slot purchases" ON public.league_slot_purchases
  FOR ALL USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


CREATE OR REPLACE FUNCTION public.get_league_creation_capacity(
  p_user_id UUID DEFAULT auth.uid()
) RETURNS TABLE (owned INT, max_leagues INT, remaining INT, is_admin BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owned INT := 0; v_slots INT := 0; v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  v_is_admin := public.has_role(p_user_id, 'admin'::app_role);
  SELECT COUNT(*)::INT INTO v_owned FROM public.leagues WHERE created_by = p_user_id;
  SELECT additional_league_slots INTO v_slots FROM public.profiles WHERE id = p_user_id;
  IF v_slots IS NULL THEN v_slots := 0; END IF;
  RETURN QUERY SELECT v_owned,
    CASE WHEN v_is_admin THEN 999 ELSE 1 + v_slots END,
    CASE WHEN v_is_admin THEN 999 - v_owned ELSE GREATEST(0, (1 + v_slots) - v_owned) END,
    v_is_admin;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_league_creation_capacity(UUID) TO authenticated;


CREATE OR REPLACE FUNCTION public.increment_league_slots(p_user_id UUID, p_delta INT)
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new INT;
BEGIN
  IF p_delta IS NULL OR p_delta <= 0 THEN
    RAISE EXCEPTION 'p_delta must be a positive integer' USING ERRCODE = '22023';
  END IF;
  UPDATE public.profiles
     SET additional_league_slots = COALESCE(additional_league_slots, 0) + p_delta,
         updated_at = NOW()
   WHERE id = p_user_id
   RETURNING additional_league_slots INTO v_new;
  IF v_new IS NULL THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id USING ERRCODE = '02000';
  END IF;
  RETURN v_new;
END; $$;

REVOKE ALL ON FUNCTION public.increment_league_slots(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_league_slots(UUID, INT) TO service_role;


CREATE OR REPLACE FUNCTION public.create_league(
  p_name TEXT, p_description TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL, p_league_type TEXT DEFAULT 'doubles'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user UUID := auth.uid(); v_is_admin BOOLEAN;
  v_owned INT; v_slots INT := 0; v_max INT; v_new_id UUID; v_trimmed TEXT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000'; END IF;
  v_trimmed := TRIM(COALESCE(p_name, ''));
  IF v_trimmed = '' THEN RAISE EXCEPTION 'League name is required' USING ERRCODE = '22023'; END IF;
  IF p_league_type NOT IN ('singles', 'doubles', 'team', 'flex', 'ladder') THEN
    RAISE EXCEPTION 'Invalid league_type %', p_league_type USING ERRCODE = '22023';
  END IF;
  v_is_admin := public.has_role(v_user, 'admin'::app_role);
  IF NOT v_is_admin THEN
    SELECT COUNT(*)::INT INTO v_owned FROM public.leagues WHERE created_by = v_user;
    SELECT additional_league_slots INTO v_slots FROM public.profiles WHERE id = v_user;
    IF v_slots IS NULL THEN v_slots := 0; END IF;
    v_max := 1 + v_slots;
    IF v_owned >= v_max THEN
      RAISE EXCEPTION 'League quota reached (owned %, max %). Buy a slot to add more.', v_owned, v_max
        USING ERRCODE = '53300', HINT = 'league_quota_exceeded';
    END IF;
  END IF;
  INSERT INTO public.leagues (name, description, location, created_by, league_type, status, visibility)
  VALUES (v_trimmed,
    NULLIF(TRIM(COALESCE(p_description, '')), ''),
    NULLIF(TRIM(COALESCE(p_location, '')), ''),
    v_user, p_league_type::league_type,
    'draft'::league_status, 'private'::league_visibility)
  RETURNING id INTO v_new_id;
  INSERT INTO public.league_audit_log (league_id, actor_user_id, action, entity_type, entity_id, new_value)
  VALUES (v_new_id, v_user, 'league.created', 'league', v_new_id,
    jsonb_build_object('name', v_trimmed, 'league_type', p_league_type, 'via', 'self_serve'));
  RETURN v_new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_league(TEXT, TEXT, TEXT, TEXT) TO authenticated;