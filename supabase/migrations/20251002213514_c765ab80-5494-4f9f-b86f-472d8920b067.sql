-- Fix search_path for check_court_availability function
CREATE OR REPLACE FUNCTION check_court_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if court is already in use for this session
  IF EXISTS (
    SELECT 1 
    FROM match_tickets 
    WHERE session_id = NEW.session_id 
      AND court_number = NEW.court_number 
      AND status IN ('live', 'on-deck')
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Court % is already in use for this session', NEW.court_number;
  END IF;
  
  RETURN NEW;
END;
$$;