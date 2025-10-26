-- Create table for MFA verification codes (email/SMS)
CREATE TABLE IF NOT EXISTS public.mfa_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('email', 'sms')),
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for faster lookups
CREATE INDEX idx_mfa_codes_user_id ON public.mfa_verification_codes(user_id);
CREATE INDEX idx_mfa_codes_code ON public.mfa_verification_codes(code);
CREATE INDEX idx_mfa_codes_expires_at ON public.mfa_verification_codes(expires_at);

-- Enable RLS
ALTER TABLE public.mfa_verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own codes
CREATE POLICY "Users can view their own MFA codes"
  ON public.mfa_verification_codes
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only the system (service role) can insert/update codes
-- This happens through edge functions

-- Add MFA preferences to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS mfa_method TEXT CHECK (mfa_method IN ('authenticator', 'email', 'sms', 'none')) DEFAULT 'none',
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Clean up old codes periodically (codes older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_expired_mfa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM mfa_verification_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;