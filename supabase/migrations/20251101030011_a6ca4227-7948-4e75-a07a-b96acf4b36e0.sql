-- QA Validation: Division Status Rules & Match Lifecycle Guards

-- Function: Validate division can be activated
CREATE OR REPLACE FUNCTION validate_division_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_count INTEGER;
BEGIN
  -- Only validate when transitioning TO active status
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    -- Check minimum team count
    SELECT COUNT(*) INTO v_team_count
    FROM tournaments_teams
    WHERE division_id = NEW.id;
    
    IF v_team_count < 2 THEN
      RAISE EXCEPTION 'Cannot activate division: Must have at least 2 teams (current: %)', v_team_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function: Validate division can be completed
CREATE OR REPLACE FUNCTION validate_division_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unfinished_count INTEGER;
BEGIN
  -- Only validate when transitioning TO completed status
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Check for unfinished matches
    SELECT COUNT(*) INTO v_unfinished_count
    FROM tournaments_matches
    WHERE division_id = NEW.id
      AND status IN ('scheduled', 'in_progress');
    
    IF v_unfinished_count > 0 THEN
      RAISE EXCEPTION 'Cannot complete division: % match(es) still scheduled or in progress', v_unfinished_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function: Prevent edits to completed divisions
CREATE OR REPLACE FUNCTION prevent_completed_division_edits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_division_status TEXT;
BEGIN
  -- Check division status for the affected record
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    -- For tournaments_teams
    IF TG_TABLE_NAME = 'tournaments_teams' THEN
      SELECT status INTO v_division_status
      FROM tournaments_divisions
      WHERE id = OLD.division_id;
      
      IF v_division_status = 'completed' THEN
        RAISE EXCEPTION 'Cannot modify teams in completed division';
      END IF;
    END IF;
    
    -- For tournaments_matches (score editing check)
    IF TG_TABLE_NAME = 'tournaments_matches' THEN
      SELECT status INTO v_division_status
      FROM tournaments_divisions
      WHERE id = OLD.division_id;
      
      IF v_division_status = 'completed' THEN
        -- Allow score_edited_by and score_edited_at updates only
        IF TG_OP = 'UPDATE' AND (
          NEW.team1_score IS DISTINCT FROM OLD.team1_score OR
          NEW.team2_score IS DISTINCT FROM OLD.team2_score OR
          NEW.status IS DISTINCT FROM OLD.status OR
          NEW.court_id IS DISTINCT FROM OLD.court_id
        ) THEN
          RAISE EXCEPTION 'Cannot modify matches in completed division (scores, status, or courts)';
        END IF;
        
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Cannot delete matches from completed division';
        END IF;
      END IF;
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: Validate match status transitions
CREATE OR REPLACE FUNCTION validate_match_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate on status change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Cannot go directly from scheduled to completed without in_progress
    IF OLD.status = 'scheduled' AND NEW.status = 'completed' THEN
      -- Allow if score is being entered at the same time
      IF NEW.team1_score IS NULL OR NEW.team2_score IS NULL THEN
        RAISE EXCEPTION 'Cannot complete match without entering scores';
      END IF;
    END IF;
    
    -- Cannot mark completed without scores
    IF NEW.status = 'completed' AND (NEW.team1_score IS NULL OR NEW.team2_score IS NULL) THEN
      RAISE EXCEPTION 'Cannot mark match as completed without scores';
    END IF;
    
    -- Set timestamps
    IF NEW.status = 'in_progress' AND OLD.status = 'scheduled' THEN
      NEW.started_at := NOW();
    END IF;
    
    IF NEW.status = 'completed' AND OLD.status IN ('scheduled', 'in_progress') THEN
      NEW.completed_at := NOW();
      -- Calculate duration if started_at exists
      IF NEW.started_at IS NOT NULL THEN
        NEW.actual_duration_minutes := EXTRACT(EPOCH FROM (NOW() - NEW.started_at)) / 60;
      END IF;
    END IF;
  END IF;
  
  -- Track score edits on completed matches
  IF NEW.status = 'completed' AND OLD.status = 'completed' THEN
    IF (NEW.team1_score IS DISTINCT FROM OLD.team1_score OR 
        NEW.team2_score IS DISTINCT FROM OLD.team2_score) THEN
      NEW.score_edited_by := auth.uid();
      NEW.score_edited_at := NOW();
      -- DO NOT update duration on edit
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function: Prevent court conflicts (same court, both in_progress)
CREATE OR REPLACE FUNCTION prevent_court_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conflict_count INTEGER;
  v_event_id UUID;
BEGIN
  -- Only check if assigning a court and match is in_progress
  IF NEW.court_id IS NOT NULL AND NEW.status = 'in_progress' THEN
    -- Get event_id
    SELECT division.event_id INTO v_event_id
    FROM tournaments_divisions division
    WHERE division.id = NEW.division_id;
    
    -- Check for conflicts (same court, same event, in_progress, different match)
    SELECT COUNT(*) INTO v_conflict_count
    FROM tournaments_matches m
    JOIN tournaments_divisions d ON m.division_id = d.id
    WHERE m.court_id = NEW.court_id
      AND m.status = 'in_progress'
      AND m.id != NEW.id
      AND d.event_id = v_event_id;
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Court conflict: Court is already in use by another in-progress match';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Apply triggers

-- Division validation triggers
DROP TRIGGER IF EXISTS trigger_validate_division_activation ON tournaments_divisions;
CREATE TRIGGER trigger_validate_division_activation
  BEFORE UPDATE ON tournaments_divisions
  FOR EACH ROW
  EXECUTE FUNCTION validate_division_activation();

DROP TRIGGER IF EXISTS trigger_validate_division_completion ON tournaments_divisions;
CREATE TRIGGER trigger_validate_division_completion
  BEFORE UPDATE ON tournaments_divisions
  FOR EACH ROW
  EXECUTE FUNCTION validate_division_completion();

-- Prevent edits to completed divisions
DROP TRIGGER IF EXISTS trigger_prevent_team_edits_completed ON tournaments_teams;
CREATE TRIGGER trigger_prevent_team_edits_completed
  BEFORE UPDATE OR DELETE ON tournaments_teams
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_division_edits();

DROP TRIGGER IF EXISTS trigger_prevent_match_edits_completed ON tournaments_matches;
CREATE TRIGGER trigger_prevent_match_edits_completed
  BEFORE UPDATE OR DELETE ON tournaments_matches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_completed_division_edits();

-- Match status transition validation
DROP TRIGGER IF EXISTS trigger_validate_match_status ON tournaments_matches;
CREATE TRIGGER trigger_validate_match_status
  BEFORE UPDATE ON tournaments_matches
  FOR EACH ROW
  EXECUTE FUNCTION validate_match_status_transition();

-- Court conflict prevention
DROP TRIGGER IF EXISTS trigger_prevent_court_conflicts ON tournaments_matches;
CREATE TRIGGER trigger_prevent_court_conflicts
  BEFORE INSERT OR UPDATE ON tournaments_matches
  FOR EACH ROW
  EXECUTE FUNCTION prevent_court_conflicts();

-- Add unique constraint on seed numbers within a division
ALTER TABLE tournaments_teams 
DROP CONSTRAINT IF EXISTS unique_seed_per_division;

ALTER TABLE tournaments_teams
ADD CONSTRAINT unique_seed_per_division 
UNIQUE NULLS NOT DISTINCT (division_id, seed_number);

-- Add check: team1_id and team2_id cannot be the same
ALTER TABLE tournaments_matches
DROP CONSTRAINT IF EXISTS different_teams_check;

ALTER TABLE tournaments_matches
ADD CONSTRAINT different_teams_check
CHECK (team1_id != team2_id);