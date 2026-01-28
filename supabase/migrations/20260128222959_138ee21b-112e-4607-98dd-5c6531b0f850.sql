-- Create partial index for pending verification venues (enum value now committed)
CREATE INDEX IF NOT EXISTS idx_venues_verification_requested ON venues(verification_requested_at) WHERE activation_state = 'pending_verification';

-- RLS policy to ensure venue owners can view their pending_verification venues
DROP POLICY IF EXISTS "Venue owners can view own venues" ON venues;
CREATE POLICY "Venue owners can view own venues"
ON venues FOR SELECT
TO authenticated
USING (owner_id = auth.uid());

-- Admins can view all venues
DROP POLICY IF EXISTS "Admins can view all venues" ON venues;
CREATE POLICY "Admins can view all venues"
ON venues FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Admins can update any venue (for verification)
DROP POLICY IF EXISTS "Admins can update any venue" ON venues;
CREATE POLICY "Admins can update any venue"
ON venues FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);