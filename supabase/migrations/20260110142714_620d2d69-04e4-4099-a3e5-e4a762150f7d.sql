-- Create helper function to check if user has tournament role for a venue
-- Uses SECURITY DEFINER with explicit search_path to fix security warnings
CREATE OR REPLACE FUNCTION has_venue_tournament_role(_user_id uuid, _venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.venues WHERE id = _venue_id AND owner_id = _user_id
    UNION
    SELECT 1 FROM public.venue_staff 
    WHERE venue_id = _venue_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'manager', 'organizer')
      AND is_active = true
  )
$$;

-- Fix search_path for slug generation functions
CREATE OR REPLACE FUNCTION generate_venue_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

CREATE OR REPLACE FUNCTION generate_tournament_slug()
RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL THEN
    NEW.slug := lower(regexp_replace(NEW.name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Update RLS policies for tournaments_events
-- First drop existing create/update policies
DROP POLICY IF EXISTS "Users can create tournaments" ON tournaments_events;
DROP POLICY IF EXISTS "Users can update their own tournaments" ON tournaments_events;
DROP POLICY IF EXISTS "Authenticated users can create events" ON tournaments_events;
DROP POLICY IF EXISTS "Authenticated users can update their own events" ON tournaments_events;

-- Create new policies that enforce venue membership for create/update
CREATE POLICY "Venue members can create tournaments"
ON tournaments_events FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND
  (venue_id IS NULL OR has_venue_tournament_role(auth.uid(), venue_id))
);

CREATE POLICY "Venue members can update tournaments"
ON tournaments_events FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR 
  (venue_id IS NOT NULL AND has_venue_tournament_role(auth.uid(), venue_id))
);

-- Public read policy for tournaments (using correct status values: upcoming, live, completed)
DROP POLICY IF EXISTS "Public can view published tournaments" ON tournaments_events;
DROP POLICY IF EXISTS "Public can view tournaments" ON tournaments_events;
DROP POLICY IF EXISTS "Anyone can view tournaments" ON tournaments_events;

CREATE POLICY "Public can view tournaments"
ON tournaments_events FOR SELECT
TO anon, authenticated
USING (
  (status IN ('upcoming', 'live', 'completed') AND visibility IN ('public', 'unlisted'))
  OR (auth.uid() IS NOT NULL AND created_by = auth.uid())
  OR (auth.uid() IS NOT NULL AND venue_id IS NOT NULL AND has_venue_tournament_role(auth.uid(), venue_id))
);