-- Add verified indicator to groups table
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS is_venue_verified boolean DEFAULT false;

-- Create validation trigger to ensure only authorized users can create venue official groups
CREATE OR REPLACE FUNCTION public.validate_venue_group()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'venue_official' AND NEW.venue_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.venues WHERE id = NEW.venue_id AND owner_id = auth.uid()
      UNION
      SELECT 1 FROM public.venue_staff 
      WHERE venue_id = NEW.venue_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'manager')
        AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Not authorized to create official group for this venue';
    END IF;
    -- Auto-set verified when venue_id is provided
    NEW.is_venue_verified := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS check_venue_group_permission ON public.groups;
CREATE TRIGGER check_venue_group_permission
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_venue_group();