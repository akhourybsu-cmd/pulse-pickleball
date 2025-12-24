-- Add public SELECT policies for venue_courts and venue_coaches
-- so public venue pages can display active courts and coaches

-- Drop existing restrictive policies if they exist
DROP POLICY IF EXISTS "Anyone can view active courts" ON venue_courts;
DROP POLICY IF EXISTS "Anyone can view active coaches" ON venue_coaches;

-- Allow anyone to view active courts (for public venue pages)
CREATE POLICY "Anyone can view active courts" ON venue_courts
  FOR SELECT USING (is_active = true);

-- Allow anyone to view active coaches (for public venue pages)  
CREATE POLICY "Anyone can view active coaches" ON venue_coaches
  FOR SELECT USING (is_active = true);