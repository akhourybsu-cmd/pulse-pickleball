-- Create a function to sync current_participants with actual registrations count
CREATE OR REPLACE FUNCTION public.sync_venue_event_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE venue_events
    SET current_participants = (
      SELECT COUNT(*) FROM venue_event_registrations
      WHERE event_id = NEW.event_id AND status = 'registered'
    )
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE venue_events
    SET current_participants = (
      SELECT COUNT(*) FROM venue_event_registrations
      WHERE event_id = OLD.event_id AND status = 'registered'
    )
    WHERE id = OLD.event_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If status changed, recalculate
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE venue_events
      SET current_participants = (
        SELECT COUNT(*) FROM venue_event_registrations
        WHERE event_id = NEW.event_id AND status = 'registered'
      )
      WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_venue_event_participants_trigger ON venue_event_registrations;

-- Create the trigger
CREATE TRIGGER sync_venue_event_participants_trigger
AFTER INSERT OR UPDATE OR DELETE ON venue_event_registrations
FOR EACH ROW
EXECUTE FUNCTION sync_venue_event_participants();

-- Also sync all existing counts to be safe
UPDATE venue_events ve
SET current_participants = (
  SELECT COUNT(*) FROM venue_event_registrations ver
  WHERE ver.event_id = ve.id AND ver.status = 'registered'
);