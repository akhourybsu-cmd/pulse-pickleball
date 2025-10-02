-- Add profile fields for player information and preferences
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS display_name TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS phonetic_name TEXT,
ADD COLUMN IF NOT EXISTS pronouns TEXT,
ADD COLUMN IF NOT EXISTS notify_score_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_score_sms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_score_push BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_badges_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_badges_sms BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notify_badges_push BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notify_weekly_digest BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS home_court_id UUID REFERENCES courts(id),
ADD COLUMN IF NOT EXISTS handedness TEXT CHECK (handedness IN ('left', 'right', 'ambidextrous')),
ADD COLUMN IF NOT EXISTS play_side TEXT CHECK (play_side IN ('forehand', 'backhand', 'either')),
ADD COLUMN IF NOT EXISTS paddle_brand TEXT,
ADD COLUMN IF NOT EXISTS paddle_model TEXT,
ADD COLUMN IF NOT EXISTS accessibility_needs TEXT,
ADD COLUMN IF NOT EXISTS partner_preferences TEXT;

-- Create index on display_name for search
CREATE INDEX IF NOT EXISTS idx_profiles_display_name ON profiles(display_name);

-- Update the get_profile_email function to also protect private fields
CREATE OR REPLACE FUNCTION public.get_own_private_fields(profile_id uuid)
RETURNS TABLE(
  accessibility_needs TEXT,
  partner_preferences TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE WHEN auth.uid() = profile_id THEN accessibility_needs ELSE NULL END,
    CASE WHEN auth.uid() = profile_id THEN partner_preferences ELSE NULL END
  FROM profiles
  WHERE id = profile_id;
$$;