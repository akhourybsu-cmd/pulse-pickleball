-- =====================================================
-- SECURITY FIX: Remove insecure venue_inquiries UPDATE policy
-- =====================================================
-- This policy allows ANYONE to update venue inquiries - critical vulnerability
DROP POLICY IF EXISTS "Anyone can update inquiry by id" ON public.venue_inquiries;

-- =====================================================
-- SECURITY FIX: Restrict profiles table sensitive data
-- =====================================================
-- The current policy allows any authenticated user to view all profile data
-- including email, phone, emergency contacts, DOB, etc.

-- Step 1: Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view limited public profile info" ON public.profiles;

-- Step 2: Create a new policy that only allows viewing non-sensitive public columns
-- Users can only see their own full profile, or use the profiles_public view for others
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Step 3: Ensure profiles_public view has proper access for authenticated users
-- The view already exists and filters sensitive data, we just need to ensure
-- the policy on the underlying table allows the view to work for admins
-- Note: The "Admins can view all profiles" policy already exists for admin access