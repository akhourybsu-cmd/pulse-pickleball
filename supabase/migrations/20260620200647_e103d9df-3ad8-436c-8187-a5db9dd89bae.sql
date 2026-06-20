UPDATE public.round_robin_events
SET num_rounds = 6
WHERE id = '9566b049-003a-4e57-b17c-3a9ca8a3a120'
  AND num_rounds < 6;

INSERT INTO public.round_robin_audit (event_id, editor_id, change_type, changes, reason)
SELECT
  e.id,
  e.organizer_id,
  'rounds_auto_adjusted',
  jsonb_build_object(
    'previous_rounds', 4,
    'new_rounds', 6,
    'active_players', 6,
    'games_per_player', e.games_per_player,
    'num_courts', e.num_courts
  ),
  'Backfill: rounds re-derived from 4 games/player target for 6 active players (rounds already existed in schedule)'
FROM public.round_robin_events e
WHERE e.id = '9566b049-003a-4e57-b17c-3a9ca8a3a120';