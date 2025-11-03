-- Fix function search_path mutable warnings by adding SET search_path to remaining functions

-- Functions that need search_path added (identified by linter)
-- Most functions already have it from previous fix, adding to any remaining ones

-- Ensure all triggers have proper search_path
CREATE OR REPLACE FUNCTION public.ensure_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- If display_name is null or empty, use full_name
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := NEW.full_name;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_mfa_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  DELETE FROM mfa_verification_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_divisions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_teams_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_matches_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_citi_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player')
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_profile_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- This will be called after match approval to update player analytics
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_match_week_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.week_start := get_week_start(NEW.match_date);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_match_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Recalculate all ratings when a new match is added
  IF NEW.status = 'approved' THEN
    PERFORM recalculate_all_ratings();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_match_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Recalculate all ratings if status changed from or to approved
  IF (OLD.status = 'approved' AND NEW.status != 'approved') OR 
     (OLD.status != 'approved' AND NEW.status = 'approved') THEN
    PERFORM recalculate_all_ratings();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_match_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Recalculate all ratings when a match is deleted
  PERFORM recalculate_all_ratings();
  RETURN OLD;
END;
$function$;