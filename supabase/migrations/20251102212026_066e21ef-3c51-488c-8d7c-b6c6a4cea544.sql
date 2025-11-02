-- Add tournament-related fields to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS shirt_size text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS dupr_rating numeric(4,2),
  ADD COLUMN IF NOT EXISTS skill_level_self text;

-- Add check constraint for gender
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_gender_check 
  CHECK (gender IS NULL OR gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say'));

-- Add check constraint for shirt size
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_shirt_size_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_shirt_size_check 
  CHECK (shirt_size IS NULL OR shirt_size IN ('XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL'));

-- Add check constraint for skill level
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skill_level_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skill_level_check 
  CHECK (skill_level_self IS NULL OR skill_level_self IN ('beginner', 'intermediate', 'advanced', 'expert'));

-- Add check constraint for DUPR rating (0.00 to 8.00)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_dupr_rating_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_dupr_rating_check 
  CHECK (dupr_rating IS NULL OR (dupr_rating >= 0 AND dupr_rating <= 8));

COMMENT ON COLUMN public.profiles.date_of_birth IS 'Player date of birth for age-based tournament divisions';
COMMENT ON COLUMN public.profiles.gender IS 'Player gender for gender-specific tournament divisions';
COMMENT ON COLUMN public.profiles.shirt_size IS 'Preferred shirt size for tournament merchandise';
COMMENT ON COLUMN public.profiles.emergency_contact_name IS 'Emergency contact name for tournaments';
COMMENT ON COLUMN public.profiles.emergency_contact_phone IS 'Emergency contact phone for tournaments';
COMMENT ON COLUMN public.profiles.dupr_rating IS 'DUPR rating if player has one (0.00 to 8.00)';
COMMENT ON COLUMN public.profiles.skill_level_self IS 'Self-assessed skill level';