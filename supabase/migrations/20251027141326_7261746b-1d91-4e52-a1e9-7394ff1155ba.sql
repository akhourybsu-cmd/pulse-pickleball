-- Fix SECURITY DEFINER view security issue
-- Convert profiles_public view to SECURITY INVOKER
-- This ensures the view executes with querying user's permissions, not the creator's

DROP VIEW IF EXISTS public.profiles_public;

CREATE VIEW public.profiles_public
WITH (security_invoker = true)
AS
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
  created_at
FROM public.profiles;

-- Grant select on the view to authenticated users
GRANT SELECT ON public.profiles_public TO authenticated;

COMMENT ON VIEW public.profiles_public IS 'Public view of profiles excluding PII (email, phone_number, accessibility_needs, partner_preferences). Uses SECURITY INVOKER to prevent RLS bypass.';