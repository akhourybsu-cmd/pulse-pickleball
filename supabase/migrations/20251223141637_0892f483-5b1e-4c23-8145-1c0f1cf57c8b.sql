-- Add public read access for venue courts (for public venue pages)
CREATE POLICY "Anyone can view active courts of active venues"
ON public.venue_courts
FOR SELECT
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM venues 
    WHERE venues.id = venue_courts.venue_id 
    AND venues.is_active = true
  )
);

-- Add public read access for venue events (published ones)
CREATE POLICY "Anyone can view published events of active venues"
ON public.venue_events
FOR SELECT
USING (
  is_published = true 
  AND EXISTS (
    SELECT 1 FROM venues 
    WHERE venues.id = venue_events.venue_id 
    AND venues.is_active = true
  )
);

-- Add public read access for venue coaches (active ones)
CREATE POLICY "Anyone can view active coaches of active venues"
ON public.venue_coaches
FOR SELECT
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1 FROM venues 
    WHERE venues.id = venue_coaches.venue_id 
    AND venues.is_active = true
  )
);