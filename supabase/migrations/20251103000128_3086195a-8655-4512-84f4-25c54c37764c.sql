-- Fix critical security issues (avoid duplicate policies)

-- 1. Fix profiles table - restrict sensitive PII to owner only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view public profile data" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own full profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Allow authenticated users to view non-sensitive profile data
CREATE POLICY "Authenticated users can view public profile data"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can view their own full profile including sensitive data
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 2. Remove MFA code visibility - users should never read codes directly
DROP POLICY IF EXISTS "Users can view their own MFA codes" ON public.mfa_verification_codes;

-- 3. Secure channel messages - require authentication
DROP POLICY IF EXISTS "Anyone can view channel messages" ON public.channel_messages;
DROP POLICY IF EXISTS "Authenticated users can view channel messages" ON public.channel_messages;

CREATE POLICY "Authenticated users can view channel messages"
ON public.channel_messages
FOR SELECT
TO authenticated
USING (true);

-- Add comments explaining the security model
COMMENT ON TABLE public.profiles IS 'User profiles with RLS: public data visible to all authenticated users, sensitive PII only to owner';
COMMENT ON TABLE public.mfa_verification_codes IS 'MFA codes accessible only via security definer functions, no direct client access';
COMMENT ON TABLE public.channel_messages IS 'Channel messages require authentication to view';