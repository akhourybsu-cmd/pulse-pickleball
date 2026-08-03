CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT id, full_name, display_name, first_name, last_name, avatar_url,
       current_rating, total_matches, wins, losses, handedness, play_side,
       paddle_brand, paddle_model, handle, created_at, gender
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO authenticated, anon;