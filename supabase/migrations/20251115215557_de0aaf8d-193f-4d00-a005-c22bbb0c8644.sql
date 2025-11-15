-- Drop existing function and trigger
DROP TRIGGER IF EXISTS trigger_auto_approve_match ON match_approvals;
DROP FUNCTION IF EXISTS auto_approve_match_on_verification();

-- Create improved auto-approve function that requires ALL participants to verify
CREATE OR REPLACE FUNCTION auto_approve_match_on_verification()
RETURNS TRIGGER AS $$
DECLARE
  approval_count INT;
  total_participants INT;
BEGIN
  -- Count how many players have approved this match
  SELECT COUNT(*) INTO approval_count
  FROM match_approvals
  WHERE match_id = NEW.match_id AND approved = true;
  
  -- Count total participants in this match
  SELECT COUNT(*) INTO total_participants
  FROM match_participants
  WHERE match_id = NEW.match_id;
  
  -- Auto-approve only when ALL participants have verified
  IF approval_count >= total_participants THEN
    UPDATE matches
    SET status = 'approved'
    WHERE id = NEW.match_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on match_approvals
CREATE TRIGGER trigger_auto_approve_match
AFTER INSERT OR UPDATE ON match_approvals
FOR EACH ROW
WHEN (NEW.approved = true)
EXECUTE FUNCTION auto_approve_match_on_verification();