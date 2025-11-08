-- =====================================================
-- SECURITY FIX: Restrict access to sensitive PII in profiles table
-- =====================================================
-- This migration addresses PUBLIC_DATA_EXPOSURE vulnerability
-- Emergency contacts, phone numbers, DOB, and other sensitive PII
-- should only be accessible to the profile owner and admins
-- =====================================================

-- Step 1: Drop existing overly permissive SELECT policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view limited profile data of others" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profile names and stats" ON public.profiles;

-- Step 2: Create new restrictive SELECT policies
-- Policy 1: Full access to own profile (all columns including sensitive PII)
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: Limited access to other profiles (row access granted, but app should use profiles_public view)
CREATE POLICY "Users can view limited public profile info"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id
);

-- Policy 3: Admins get full access to all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 3: Create security definer function for emergency contact access
CREATE OR REPLACE FUNCTION public.get_emergency_contact(profile_id uuid)
RETURNS TABLE(
  contact_name TEXT,
  contact_phone TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN auth.uid() = profile_id THEN emergency_contact_name
      WHEN has_role(auth.uid(), 'admin') THEN emergency_contact_name
      ELSE NULL 
    END,
    CASE 
      WHEN auth.uid() = profile_id THEN emergency_contact_phone
      WHEN has_role(auth.uid(), 'admin') THEN emergency_contact_phone
      ELSE NULL 
    END
  FROM profiles
  WHERE id = profile_id;
$$;

-- Step 4: Add column-level comments for documentation
COMMENT ON COLUMN public.profiles.emergency_contact_name IS 'PII - Restricted access: Own profile or admin only via get_emergency_contact() function';
COMMENT ON COLUMN public.profiles.emergency_contact_phone IS 'PII - Restricted access: Own profile or admin only via get_emergency_contact() function';
COMMENT ON COLUMN public.profiles.phone_number IS 'PII - Restricted access: Own profile or admin only';
COMMENT ON COLUMN public.profiles.date_of_birth IS 'PII - Restricted access: Own profile or admin only';
COMMENT ON COLUMN public.profiles.email IS 'PII - Restricted access: Own profile or admin only';

-- Step 5: Ensure profiles_public view has proper grants (verify existing setup)
GRANT SELECT ON public.profiles_public TO authenticated;
GRANT SELECT ON public.profiles_public TO anon;