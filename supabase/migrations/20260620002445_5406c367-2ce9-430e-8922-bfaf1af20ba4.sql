-- Backfill: auto-approve the submitter's teammate(s) on existing pending matches.
-- The submitter (matches.created_by) already played the game on their side, so
-- their partner is treated as confirming the same result. Opponents still need
-- to confirm individually. Only touches rows where the approval is still null
-- (never overwrites an explicit approve/reject).
UPDATE public.match_approvals ma
SET approved = true,
    approved_at = now()
FROM public.matches m
JOIN public.match_participants creator_mp
  ON creator_mp.match_id = m.id
 AND creator_mp.player_id = m.created_by
JOIN public.match_participants teammate_mp
  ON teammate_mp.match_id = m.id
 AND teammate_mp.team = creator_mp.team
WHERE ma.match_id = m.id
  AND ma.player_id = teammate_mp.player_id
  AND ma.player_id <> m.created_by
  AND ma.approved IS NULL
  AND m.status = 'pending';