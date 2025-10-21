-- Fix critical security issues: Add admin role checks to destructive functions

-- Fix clear_all_match_history_authenticated to require admin role
CREATE OR REPLACE FUNCTION public.clear_all_match_history_authenticated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admin users to trigger cleanup
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  
  PERFORM clear_all_match_history();
END;
$function$;

-- Fix recalculate_all_ratings_authenticated to require admin role
CREATE OR REPLACE FUNCTION public.recalculate_all_ratings_authenticated()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only allow admin users to trigger recalculation
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin role required';
  END IF;
  
  PERFORM recalculate_all_ratings();
END;
$function$;