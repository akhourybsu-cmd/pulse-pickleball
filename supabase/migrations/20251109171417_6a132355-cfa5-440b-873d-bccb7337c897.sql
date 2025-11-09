-- Create biometric credentials table
CREATE TABLE IF NOT EXISTS public.biometric_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  device_name TEXT NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on biometric credentials
ALTER TABLE public.biometric_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only view their own credentials
CREATE POLICY "Users can view their own biometric credentials"
  ON public.biometric_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own credentials
CREATE POLICY "Users can create their own biometric credentials"
  ON public.biometric_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own credentials
CREATE POLICY "Users can delete their own biometric credentials"
  ON public.biometric_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Users can update their own credentials (for last_used_at)
CREATE POLICY "Users can update their own biometric credentials"
  ON public.biometric_credentials
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Add biometric_enabled column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS biometric_enabled BOOLEAN DEFAULT FALSE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_biometric_credentials_user_id 
  ON public.biometric_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_biometric_credentials_credential_id 
  ON public.biometric_credentials(credential_id);