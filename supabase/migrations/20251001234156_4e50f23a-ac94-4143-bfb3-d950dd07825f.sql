-- Fix nullable user reference fields that could bypass RLS
ALTER TABLE match_participants 
  ALTER COLUMN player_id SET NOT NULL,
  ALTER COLUMN match_id SET NOT NULL;

ALTER TABLE matches 
  ALTER COLUMN created_by SET NOT NULL;

-- Tighten RLS policy on match_participants to prevent unauthorized insertions
DROP POLICY IF EXISTS "System can insert match participants" ON match_participants;

CREATE POLICY "Match creators can insert participants"
ON match_participants
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM matches 
    WHERE matches.id = match_participants.match_id 
    AND matches.created_by = auth.uid()
  )
);

-- Ensure match_participants can only be inserted during match creation
-- Add policy to allow viewing match participants
CREATE POLICY "Users can view match participants for matches they're involved in"
ON match_participants
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = match_participants.match_id
    AND (
      m.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM match_participants mp
        WHERE mp.match_id = m.id AND mp.player_id = auth.uid()
      )
    )
  )
);