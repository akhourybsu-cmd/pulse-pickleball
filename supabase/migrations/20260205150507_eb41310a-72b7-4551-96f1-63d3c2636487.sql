-- Create sync function for tournaments to unified_events
CREATE OR REPLACE FUNCTION sync_tournament_to_unified_events()
RETURNS TRIGGER AS $$
DECLARE
  unified_status TEXT;
  unified_visibility TEXT;
BEGIN
  -- Determine visibility
  IF NEW.public_view_enabled THEN
    unified_visibility := 'public';
  ELSE
    unified_visibility := 'private';
  END IF;

  -- Determine status based on registration
  IF NEW.status = 'completed' THEN
    unified_status := 'completed';
  ELSIF NEW.status = 'cancelled' THEN
    unified_status := 'cancelled';
  ELSIF NEW.registration_enabled THEN
    IF NEW.registration_open_date IS NOT NULL AND NOW() < NEW.registration_open_date THEN
      unified_status := 'published';
    ELSIF NEW.registration_close_date IS NOT NULL AND NOW() > NEW.registration_close_date THEN
      unified_status := 'registration_closed';
    ELSE
      unified_status := 'registration_open';
    END IF;
  ELSE
    unified_status := 'published';
  END IF;

  -- Handle INSERT/UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO unified_events (
      id, title, description, event_type, host_type,
      host_venue_id, start_time, end_time, venue_id,
      price, visibility, status, is_published,
      created_by, legacy_table, legacy_id
    ) VALUES (
      NEW.id,
      NEW.name,
      NEW.description,
      'tournament',
      CASE WHEN NEW.venue_id IS NOT NULL THEN 'venue' ELSE 'individual' END,
      NEW.venue_id,
      NEW.start_date::timestamptz,
      NEW.end_date::timestamptz,
      NEW.venue_id,
      NEW.registration_fee,
      unified_visibility,
      unified_status,
      NEW.public_view_enabled,
      NEW.created_by,
      'tournaments_events',
      NEW.id
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      host_venue_id = EXCLUDED.host_venue_id,
      venue_id = EXCLUDED.venue_id,
      price = EXCLUDED.price,
      visibility = EXCLUDED.visibility,
      status = EXCLUDED.status,
      is_published = EXCLUDED.is_published,
      updated_at = NOW();
    
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM unified_events WHERE legacy_id = OLD.id AND legacy_table = 'tournaments_events';
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on tournaments_events
DROP TRIGGER IF EXISTS sync_tournament_unified ON tournaments_events;
CREATE TRIGGER sync_tournament_unified
AFTER INSERT OR UPDATE OR DELETE ON tournaments_events
FOR EACH ROW
EXECUTE FUNCTION sync_tournament_to_unified_events();

-- Backfill existing tournaments to unified_events
INSERT INTO unified_events (
  id, title, description, event_type, host_type,
  host_venue_id, start_time, end_time, venue_id,
  price, visibility, status, is_published,
  created_by, legacy_table, legacy_id
)
SELECT 
  t.id,
  t.name,
  t.description,
  'tournament',
  CASE WHEN t.venue_id IS NOT NULL THEN 'venue' ELSE 'individual' END,
  t.venue_id,
  t.start_date::timestamptz,
  t.end_date::timestamptz,
  t.venue_id,
  t.registration_fee,
  CASE WHEN t.public_view_enabled THEN 'public' ELSE 'private' END,
  CASE 
    WHEN t.status = 'completed' THEN 'completed'
    WHEN t.status = 'cancelled' THEN 'cancelled'
    WHEN t.registration_enabled THEN 'registration_open'
    ELSE 'published'
  END,
  t.public_view_enabled,
  t.created_by,
  'tournaments_events',
  t.id
FROM tournaments_events t
WHERE t.start_date >= CURRENT_DATE
ON CONFLICT (id) DO NOTHING;