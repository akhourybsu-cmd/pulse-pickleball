-- Fix the search_path security warning by adding SET search_path to the function
CREATE OR REPLACE FUNCTION public.ensure_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If display_name is null or empty, use full_name
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := NEW.full_name;
  END IF;
  
  RETURN NEW;
END;
$$;