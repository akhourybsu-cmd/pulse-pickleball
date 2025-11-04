-- Function to check and process full boxes
CREATE OR REPLACE FUNCTION process_full_boxes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_box_count INTEGER;
BEGIN
  -- Only process if a box_number is set
  IF NEW.box_number IS NOT NULL THEN
    -- Count players in this box
    SELECT COUNT(*) INTO v_box_count
    FROM queue_entries
    WHERE session_id = NEW.session_id
      AND box_number = NEW.box_number
      AND status = 'waiting';
    
    -- If box is now full (4 players), clear box numbers so they become the next queue
    IF v_box_count = 4 THEN
      UPDATE queue_entries
      SET box_number = NULL
      WHERE session_id = NEW.session_id
        AND box_number = NEW.box_number
        AND status = 'waiting';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on queue_entries
DROP TRIGGER IF EXISTS trigger_process_full_boxes ON queue_entries;
CREATE TRIGGER trigger_process_full_boxes
  AFTER INSERT ON queue_entries
  FOR EACH ROW
  EXECUTE FUNCTION process_full_boxes();

-- Also trigger on updates in case box_number is modified
DROP TRIGGER IF EXISTS trigger_process_full_boxes_update ON queue_entries;
CREATE TRIGGER trigger_process_full_boxes_update
  AFTER UPDATE OF box_number ON queue_entries
  FOR EACH ROW
  WHEN (NEW.box_number IS DISTINCT FROM OLD.box_number)
  EXECUTE FUNCTION process_full_boxes();