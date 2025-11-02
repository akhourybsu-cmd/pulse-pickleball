-- Update skill level constraint to new categories
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_skill_level_check;
  
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_skill_level_check 
  CHECK (skill_level_self IS NULL OR skill_level_self IN ('beginner', 'intermediate', 'advanced', 'semi_pro', 'pro'));

-- Update comment
COMMENT ON COLUMN public.profiles.skill_level_self IS 'Self-assessed skill level: beginner, intermediate, advanced, semi_pro, or pro';