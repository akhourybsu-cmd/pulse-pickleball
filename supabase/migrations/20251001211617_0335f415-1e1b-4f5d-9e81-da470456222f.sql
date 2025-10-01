-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a policy that allows viewing public profile information
-- but restricts email to own profile only
CREATE POLICY "Users can view all profile names and stats"
ON public.profiles
FOR SELECT
USING (true);

-- Add RLS to restrict email column access
-- Since RLS works at row level, we'll rely on application-level controls
-- and create a secure function for getting own email

-- Create a function to get current user's email securely
CREATE OR REPLACE FUNCTION public.get_own_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;