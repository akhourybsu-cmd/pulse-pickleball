-- Drop home_court_id from profiles and recreate profiles_public without it
DROP VIEW IF EXISTS public.profiles_public;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS home_court_id;

CREATE VIEW public.profiles_public AS
SELECT
  id, full_name, display_name, first_name, last_name,
  avatar_url, current_rating, total_matches, wins, losses,
  handedness, play_side, paddle_brand, paddle_model,
  handle, created_at
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;