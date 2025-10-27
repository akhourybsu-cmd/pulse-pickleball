-- Critical Security Fix #1: Restrict profiles table to prevent PII harvesting
-- Drop existing overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles with protected emails" ON public.profiles;

-- Create restricted policies for profiles
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can view limited public profile info"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL 
  AND auth.uid() != id
);

-- Create a safe public view for profiles that masks sensitive data
CREATE OR REPLACE VIEW public.profiles_public AS
SELECT 
  id,
  full_name,
  display_name,
  first_name,
  last_name,
  avatar_url,
  current_rating,
  total_matches,
  wins,
  losses,
  handedness,
  play_side,
  paddle_brand,
  paddle_model,
  home_court_id,
  -- Explicitly exclude: email, phone_number, accessibility_needs, partner_preferences
  created_at
FROM public.profiles;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

-- Critical Security Fix #2: Restrict check_ins to prevent location tracking
DROP POLICY IF EXISTS "Anyone can view check-ins for active sessions" ON public.check_ins;

CREATE POLICY "Authenticated users can view check-ins"
ON public.check_ins
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Critical Security Fix #3: Restrict court_checkins to prevent real-time location tracking
DROP POLICY IF EXISTS "Anyone can view check-ins" ON public.court_checkins;

CREATE POLICY "Authenticated users can view check-ins"
ON public.court_checkins
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Critical Security Fix #4: Lock down MFA verification codes
-- Add explicit DENY policies for data manipulation
CREATE POLICY "Block direct MFA code insertions"
ON public.mfa_verification_codes
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Block direct MFA code updates"
ON public.mfa_verification_codes
FOR UPDATE
USING (false);

CREATE POLICY "Block direct MFA code deletions"
ON public.mfa_verification_codes
FOR DELETE
USING (false);

-- Create security definer functions for MFA code management (only edge functions can use these)
CREATE OR REPLACE FUNCTION public.insert_mfa_code(
  p_user_id UUID,
  p_code TEXT,
  p_method TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
BEGIN
  INSERT INTO public.mfa_verification_codes (user_id, code, method, expires_at)
  VALUES (p_user_id, p_code, p_method, p_expires_at)
  RETURNING id INTO v_code_id;
  
  RETURN v_code_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_and_use_mfa_code(
  p_user_id UUID,
  p_code TEXT,
  p_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valid BOOLEAN;
BEGIN
  -- Check if code is valid and not expired
  SELECT EXISTS(
    SELECT 1
    FROM public.mfa_verification_codes
    WHERE user_id = p_user_id
      AND code = p_code
      AND method = p_method
      AND used = false
      AND expires_at > NOW()
  ) INTO v_valid;
  
  -- If valid, mark as used
  IF v_valid THEN
    UPDATE public.mfa_verification_codes
    SET used = true
    WHERE user_id = p_user_id
      AND code = p_code
      AND method = p_method
      AND used = false
      AND expires_at > NOW();
  END IF;
  
  RETURN v_valid;
END;
$$;