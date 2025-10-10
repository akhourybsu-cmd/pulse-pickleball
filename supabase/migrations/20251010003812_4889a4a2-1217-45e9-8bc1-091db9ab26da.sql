-- Add verification tracking to matches
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS verified_by uuid[] DEFAULT '{}';

-- Add reported issues table
CREATE TABLE IF NOT EXISTS match_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES profiles(id),
  issue_type text NOT NULL CHECK (issue_type IN ('contest_result', 'wrong_court', 'wrong_opponent', 'didnt_play')),
  details text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id)
);

-- Enable RLS on match_issues
ALTER TABLE match_issues ENABLE ROW LEVEL SECURITY;

-- Users can view issues for matches they participated in
CREATE POLICY "Users can view issues for their matches"
ON match_issues FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_issues.match_id
    AND mp.player_id = auth.uid()
  )
);

-- Users can report issues for matches they participated in
CREATE POLICY "Users can report issues for their matches"
ON match_issues FOR INSERT
WITH CHECK (
  auth.uid() = reported_by
  AND EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = match_issues.match_id
    AND mp.player_id = auth.uid()
  )
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_match_issues_match_id ON match_issues(match_id);
CREATE INDEX IF NOT EXISTS idx_match_issues_reported_by ON match_issues(reported_by);