-- Force verify all matches by setting verified_by to all participant IDs
UPDATE public.matches
SET verified_by = (
  SELECT array_agg(DISTINCT mp.player_id::text)
  FROM public.match_participants mp
  WHERE mp.match_id = matches.id
)
WHERE id IN (
  SELECT DISTINCT match_id 
  FROM public.match_participants
);