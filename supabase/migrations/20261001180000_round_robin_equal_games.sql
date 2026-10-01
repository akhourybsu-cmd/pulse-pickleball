-- Existing events keep their selected schedule behavior. New events default
-- to equal actual games, with the option available in Courts & Games.
ALTER TABLE public.round_robin_events ADD COLUMN IF NOT EXISTS equal_games boolean NOT NULL DEFAULT false;
ALTER TABLE public.round_robin_events ALTER COLUMN equal_games SET DEFAULT true;

-- Patch the current definition so later venue-manager authorization changes
-- remain intact. The service-only RPC still locks, validates, and commits the
-- roster, schedule, settings, version, and audit atomically.
DO $migration$
DECLARE
  definition text;
  original text;
BEGIN
  definition := pg_get_functiondef('public.rr_apply_schedule_rebuild(uuid,uuid,uuid,integer,integer,integer,integer,integer,jsonb,jsonb,text,jsonb,jsonb)'::regprocedure);
  IF position('Equal-game totals must match' IN definition) > 0 THEN RETURN; END IF;
  original := definition;
  definition := replace(definition,
    'HAVING count(*) FILTER (WHERE NOT x.is_bye) <> v_expected_matches_per_round',
    $new$HAVING count(*) FILTER (WHERE NOT x.is_bye) < 1
       OR count(*) FILTER (WHERE NOT x.is_bye) > v_expected_matches_per_round
       OR (NOT COALESCE((p_impact #>> '{capacity,equalGames}')::boolean, v_event.equal_games)
           AND count(*) FILTER (WHERE NOT x.is_bye) <> v_expected_matches_per_round)$new$);
  IF definition = original THEN RAISE EXCEPTION 'Round-robin capacity guard not found'; END IF;
  original := definition;
  definition := replace(definition, 'games_per_player = p_games_per_player,',
    $new$games_per_player = p_games_per_player,
         equal_games = COALESCE((p_impact #>> '{capacity,equalGames}')::boolean, v_event.equal_games),$new$);
  IF definition = original THEN RAISE EXCEPTION 'Round-robin settings write not found'; END IF;
  original := definition;
  definition := replace(definition, '  DELETE FROM public.round_robin_schedule s', $new$
  -- Equal-game totals must match actual appearances, never byes or virtual
  -- allocation credits. Do this before deleting any future rows.
  IF COALESCE((p_impact #>> '{capacity,equalGames}')::boolean, v_event.equal_games) AND EXISTS (
    WITH games AS (
      SELECT a1_player_id, a1_guest_id, a2_player_id, a2_guest_id,
             b1_player_id, b1_guest_id, b2_player_id, b2_guest_id
        FROM public.round_robin_schedule
       WHERE event_id = p_event_id AND round_no < p_regenerate_from_round
         AND NOT is_bye AND NOT COALESCE(abandoned, false)
         AND voided_at IS NULL AND superseded_by_schedule_id IS NULL
      UNION ALL
      SELECT a1_player_id, a1_guest_id, a2_player_id, a2_guest_id,
             b1_player_id, b1_guest_id, b2_player_id, b2_guest_id
        FROM jsonb_to_recordset(p_schedule) AS x(is_bye boolean,
          a1_player_id uuid, a1_guest_id uuid, a2_player_id uuid, a2_guest_id uuid,
          b1_player_id uuid, b1_guest_id uuid, b2_player_id uuid, b2_guest_id uuid)
       WHERE NOT x.is_bye
    ), appearances AS (
      SELECT v.player_id, v.guest_id
        FROM games g CROSS JOIN LATERAL (VALUES
          (g.a1_player_id, g.a1_guest_id), (g.a2_player_id, g.a2_guest_id),
          (g.b1_player_id, g.b1_guest_id), (g.b2_player_id, g.b2_guest_id)
        ) v(player_id, guest_id)
    )
    SELECT 1 FROM public.round_robin_players p
      LEFT JOIN appearances a ON
        (p.player_id IS NOT NULL AND a.player_id = p.player_id) OR
        (p.guest_player_id IS NOT NULL AND a.guest_id = p.guest_player_id)
     WHERE p.event_id = p_event_id AND p.active = true
     GROUP BY p.id
    HAVING count(COALESCE(a.player_id, a.guest_id)) <> p_games_per_player
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RR_INVALID_PLAN:Equal-game totals must match the target for every active player';
  END IF;

  DELETE FROM public.round_robin_schedule s$new$);
  IF definition = original THEN RAISE EXCEPTION 'Round-robin schedule write not found'; END IF;
  EXECUTE definition;
END
$migration$;

COMMENT ON COLUMN public.round_robin_events.equal_games IS
  'Require equal actual games for active players; permits partial rounds. Impossible targets are raised uniformly or rejected before applying a schedule.';
