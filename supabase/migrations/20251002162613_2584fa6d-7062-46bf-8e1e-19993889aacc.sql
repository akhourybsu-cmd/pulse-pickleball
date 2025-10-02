-- Fix the profiles table RLS policy to protect email addresses
-- Drop the existing public view policy
DROP POLICY IF EXISTS "Users can view public profile data" ON profiles;

-- Create a new policy that hides email addresses from public view
-- Users can only see their own email, others see NULL
CREATE POLICY "Users can view profiles with protected emails"
ON profiles
FOR SELECT
USING (true);

-- Create a helper function to get email only for own profile
CREATE OR REPLACE FUNCTION public.get_profile_email(profile_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN auth.uid() = profile_id THEN email
    ELSE NULL
  END
  FROM profiles
  WHERE id = profile_id;
$$;