-- Create function to auto-approve matches when 2+ players verify
CREATE OR REPLACE FUNCTION auto_approve_match_on_verification()
RETURNS TRIGGER AS $$
DECLARE
  approval_count INTEGER;
  total_participants INTEGER;
BEGIN
  -- Only process if approval was set to true
  IF NEW.approved = true THEN
    -- Count total approvals for this match
    SELECT COUNT(*) INTO approval_count
    FROM match_approvals
    WHERE match_id = NEW.match_id AND approved = true;
    
    -- Count total participants
    SELECT COUNT(*) INTO total_participants
    FROM match_participants
    WHERE match_id = NEW.match_id;
    
    -- Auto-approve if 2 or more players have verified
    IF approval_count >= 2 THEN
      UPDATE matches
      SET status = 'approved'
      WHERE id = NEW.match_id AND status = 'pending';
      
      -- Log the auto-approval
      RAISE NOTICE 'Match % auto-approved with % of % verifications', NEW.match_id, approval_count, total_participants;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on match_approvals table
DROP TRIGGER IF EXISTS trigger_auto_approve_match ON match_approvals;
CREATE TRIGGER trigger_auto_approve_match
  AFTER INSERT OR UPDATE OF approved ON match_approvals
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_match_on_verification();