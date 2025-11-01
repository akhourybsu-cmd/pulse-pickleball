-- Add public view control to tournaments_events
ALTER TABLE tournaments_events 
ADD COLUMN public_view_enabled BOOLEAN NOT NULL DEFAULT false;

-- Enable realtime for tournaments_matches and tournaments_divisions
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments_divisions;

-- RLS: Public can view enabled events
CREATE POLICY "Public can view enabled events"
ON tournaments_events FOR SELECT
USING (public_view_enabled = true);

-- RLS: Public can view divisions of enabled events
CREATE POLICY "Public can view divisions of enabled events"
ON tournaments_divisions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments_events
    WHERE tournaments_events.id = tournaments_divisions.event_id
    AND tournaments_events.public_view_enabled = true
  )
);

-- RLS: Public can view teams of enabled events
CREATE POLICY "Public can view teams of enabled events"
ON tournaments_teams FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments_divisions
    JOIN tournaments_events ON tournaments_events.id = tournaments_divisions.event_id
    WHERE tournaments_divisions.id = tournaments_teams.division_id
    AND tournaments_events.public_view_enabled = true
  )
);

-- RLS: Public can view matches of enabled events
CREATE POLICY "Public can view matches of enabled events"
ON tournaments_matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments_divisions
    JOIN tournaments_events ON tournaments_events.id = tournaments_divisions.event_id
    WHERE tournaments_divisions.id = tournaments_matches.division_id
    AND tournaments_events.public_view_enabled = true
  )
);

-- RLS: Public can view courts of enabled events
CREATE POLICY "Public can view courts of enabled events"
ON tournaments_courts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM tournaments_events
    WHERE tournaments_events.id = tournaments_courts.event_id
    AND tournaments_events.public_view_enabled = true
  )
);