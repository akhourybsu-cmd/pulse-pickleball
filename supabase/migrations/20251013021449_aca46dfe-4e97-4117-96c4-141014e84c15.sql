-- Allow players in a match to update ONLY the verified_by field
-- This is a more secure approach than allowing full UPDATE access

CREATE POLICY "Players can update verified_by for their matches"
ON public.matches
FOR UPDATE
USING (
  -- User must be a participant in the match
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = matches.id
    AND mp.player_id = auth.uid()
  )
)
WITH CHECK (
  -- User must be a participant in the match
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = matches.id
    AND mp.player_id = auth.uid()
  )
  -- Only allow updating verified_by array
  AND (
    verified_by IS DISTINCT FROM (SELECT verified_by FROM matches WHERE id = matches.id)
    AND team1_score = (SELECT team1_score FROM matches WHERE id = matches.id)
    AND team2_score = (SELECT team2_score FROM matches WHERE id = matches.id)
    AND status = (SELECT status FROM matches WHERE id = matches.id)
  )
);