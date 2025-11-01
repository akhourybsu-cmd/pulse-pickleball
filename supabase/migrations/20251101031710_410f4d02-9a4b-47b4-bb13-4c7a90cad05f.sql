-- Enable RLS on tournaments_scoring_rulesets if not already enabled
ALTER TABLE tournaments_scoring_rulesets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view scoring rulesets" ON tournaments_scoring_rulesets;
DROP POLICY IF EXISTS "Public can view scoring rulesets" ON tournaments_scoring_rulesets;

-- Allow admins to view all scoring rulesets
CREATE POLICY "Admins can view scoring rulesets"
ON tournaments_scoring_rulesets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow public to view scoring rulesets (needed for division creation)
CREATE POLICY "Public can view scoring rulesets"
ON tournaments_scoring_rulesets
FOR SELECT
TO authenticated
USING (true);