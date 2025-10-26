-- Create a function to auto-populate display_name from full_name if missing
CREATE OR REPLACE FUNCTION public.ensure_display_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If display_name is null or empty, use full_name
  IF NEW.display_name IS NULL OR NEW.display_name = '' THEN
    NEW.display_name := NEW.full_name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate display_name on insert
DROP TRIGGER IF EXISTS trigger_ensure_display_name_on_insert ON public.profiles;
CREATE TRIGGER trigger_ensure_display_name_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_display_name();

-- Create trigger to auto-populate display_name on update
DROP TRIGGER IF EXISTS trigger_ensure_display_name_on_update ON public.profiles;
CREATE TRIGGER trigger_ensure_display_name_on_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_display_name();

-- Backfill existing profiles that have full_name but missing display_name
UPDATE public.profiles
SET display_name = full_name
WHERE (display_name IS NULL OR display_name = '')
  AND full_name IS NOT NULL
  AND full_name != '';