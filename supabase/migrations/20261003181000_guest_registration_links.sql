BEGIN;
-- A claimed guest already owns a registration. Shared entry and rejoining must
-- reuse that row rather than offer a second registered-player seat.
DO $$
DECLARE name text; definition text;
BEGIN
  FOREACH name IN ARRAY ARRAY['get_round_robin_entry', 'join_round_robin_event'] LOOP
    SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = name AND p.pronargs = 2;
    IF definition IS NULL THEN RAISE EXCEPTION 'Missing round robin registration function: %', name; END IF;
    IF position('GUEST_REGISTRATION_IDENTITY' IN definition) = 0 THEN
      IF position('AND r.player_id=auth.uid();' IN definition) = 0 THEN
        RAISE EXCEPTION 'Unrecognized round robin registration lookup: %', name;
      END IF;
      EXECUTE replace(definition, 'AND r.player_id=auth.uid();',
        'AND (r.player_id=auth.uid() OR EXISTS (SELECT 1 FROM public.guest_players gp WHERE gp.id=r.guest_player_id AND gp.linked_user_id=auth.uid())) ORDER BY (r.player_id IS NOT NULL) DESC LIMIT 1; -- GUEST_REGISTRATION_IDENTITY');
    END IF;
  END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
