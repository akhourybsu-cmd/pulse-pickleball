-- Fix RLS policies to allow venue owners (not just staff) to manage venue assets

-- =====================================================
-- 1. FIX venue_events POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Venue staff can create events" ON venue_events;
DROP POLICY IF EXISTS "Venue staff can update events" ON venue_events;
DROP POLICY IF EXISTS "Managers can delete events" ON venue_events;
DROP POLICY IF EXISTS "Venue staff can view events" ON venue_events;

-- Create new policies that include venue owners
CREATE POLICY "Venue staff or owners can create events" ON venue_events
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_events.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_events.venue_id AND owner_id = auth.uid())
  );

CREATE POLICY "Venue staff or owners can update events" ON venue_events
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_events.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_events.venue_id AND owner_id = auth.uid())
  );

CREATE POLICY "Managers or owners can delete events" ON venue_events
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_events.venue_id AND vs.user_id = auth.uid() AND vs.role IN ('owner', 'manager') AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_events.venue_id AND owner_id = auth.uid())
  );

CREATE POLICY "Venue staff or owners can view events" ON venue_events
  FOR SELECT USING (
    is_published = true
    OR EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_events.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_events.venue_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 2. FIX venue_courts POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Venue managers can manage courts" ON venue_courts;
DROP POLICY IF EXISTS "Venue staff can view courts" ON venue_courts;

-- Create new policies that include venue owners
CREATE POLICY "Venue managers or owners can manage courts" ON venue_courts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_courts.venue_id AND vs.user_id = auth.uid() AND vs.role IN ('owner', 'manager') AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_courts.venue_id AND owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_courts.venue_id AND vs.user_id = auth.uid() AND vs.role IN ('owner', 'manager') AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_courts.venue_id AND owner_id = auth.uid())
  );

CREATE POLICY "Venue staff or owners can view courts" ON venue_courts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_courts.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_courts.venue_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 3. FIX venue_coaches POLICIES
-- =====================================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Venue managers can manage coaches" ON venue_coaches;
DROP POLICY IF EXISTS "Venue staff can view coaches" ON venue_coaches;

-- Create new policies that include venue owners
CREATE POLICY "Venue managers or owners can manage coaches" ON venue_coaches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_coaches.venue_id AND vs.user_id = auth.uid() AND vs.role IN ('owner', 'manager') AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_coaches.venue_id AND owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_coaches.venue_id AND vs.user_id = auth.uid() AND vs.role IN ('owner', 'manager') AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_coaches.venue_id AND owner_id = auth.uid())
  );

CREATE POLICY "Venue staff or owners can view coaches" ON venue_coaches
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_coaches.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_coaches.venue_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 4. FIX venue_bookings POLICIES for admin visibility
-- =====================================================

-- Drop and recreate to include owner check
DROP POLICY IF EXISTS "Venue staff can view bookings" ON venue_bookings;

CREATE POLICY "Venue staff or owners can view bookings" ON venue_bookings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM venue_staff vs WHERE vs.venue_id = venue_bookings.venue_id AND vs.user_id = auth.uid() AND vs.is_active = true)
    OR EXISTS (SELECT 1 FROM venues WHERE id = venue_bookings.venue_id AND owner_id = auth.uid())
  );

-- =====================================================
-- 5. INSERT Pickleball Palace owner into venue_staff
-- =====================================================

-- Belt-and-suspenders: ensure the owner is in venue_staff
INSERT INTO venue_staff (venue_id, user_id, role, is_active)
SELECT 
  '3a9f6e6b-6b6a-4f9d-8b24-8959c92ef266'::uuid,
  'fff594fe-02ea-439c-a974-72e1f6295f08'::uuid,
  'owner'::venue_role,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM venue_staff 
  WHERE venue_id = '3a9f6e6b-6b6a-4f9d-8b24-8959c92ef266' 
  AND user_id = 'fff594fe-02ea-439c-a974-72e1f6295f08'
);