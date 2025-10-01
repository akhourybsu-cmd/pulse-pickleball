-- Fix RLS policy conflict - remove duplicate SELECT policy on match_participants
DROP POLICY IF EXISTS "Users can view all match participants" ON match_participants;

-- The "Users can view match participants for matches they're involved in" policy 
-- already exists and is more secure, so we keep that one