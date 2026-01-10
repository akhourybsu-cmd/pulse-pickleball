-- Add 'organizer' role to venue_role enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'organizer' AND enumtypid = 'venue_role'::regtype) THEN
    ALTER TYPE venue_role ADD VALUE 'organizer';
  END IF;
END$$;

-- Create tournament_visibility enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_visibility') THEN
    CREATE TYPE tournament_visibility AS ENUM ('public', 'unlisted', 'private');
  END IF;
END$$;

-- Add venue_id, visibility, external_registration_url, and slug to tournaments_events
ALTER TABLE tournaments_events 
ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES venues(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS visibility tournament_visibility DEFAULT 'public',
ADD COLUMN IF NOT EXISTS external_registration_url text,
ADD COLUMN IF NOT EXISTS slug text;

-- Add unique constraint on slug if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_events_slug_key'
  ) THEN
    ALTER TABLE tournaments_events ADD CONSTRAINT tournaments_events_slug_key UNIQUE (slug);
  END IF;
END$$;

-- Add is_published and slug to venues
ALTER TABLE venues 
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS slug text;

-- Add unique constraint on venues slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'venues_slug_key'
  ) THEN
    ALTER TABLE venues ADD CONSTRAINT venues_slug_key UNIQUE (slug);
  END IF;
END$$;

-- Generate slug function for venues
CREATE OR REPLACE FUNCTION generate_venue_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate slug function for tournaments
CREATE OR REPLACE FUNCTION generate_tournament_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for slug generation
DROP TRIGGER IF EXISTS set_venue_slug ON venues;
CREATE TRIGGER set_venue_slug
  BEFORE INSERT ON venues
  FOR EACH ROW EXECUTE FUNCTION generate_venue_slug();

DROP TRIGGER IF EXISTS set_tournament_slug ON tournaments_events;
CREATE TRIGGER set_tournament_slug
  BEFORE INSERT ON tournaments_events
  FOR EACH ROW EXECUTE FUNCTION generate_tournament_slug();