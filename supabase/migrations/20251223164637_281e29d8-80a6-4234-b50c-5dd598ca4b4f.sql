-- Backfill existing profiles: parse full_name to populate first_name and last_name
UPDATE profiles 
SET 
  first_name = COALESCE(
    first_name, 
    CASE 
      WHEN full_name IS NOT NULL AND full_name != '' THEN 
        TRIM(split_part(full_name, ' ', 1))
      ELSE ''
    END
  ),
  last_name = COALESCE(
    last_name,
    CASE 
      WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
        TRIM(substring(full_name from position(' ' in full_name) + 1))
      ELSE ''
    END
  )
WHERE first_name IS NULL OR last_name IS NULL;

-- Update the handle_new_user trigger to extract first_name and last_name from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  raw_first_name text;
  raw_last_name text;
  raw_full_name text;
BEGIN
  -- Extract from user metadata
  raw_first_name := COALESCE(new.raw_user_meta_data ->> 'first_name', '');
  raw_last_name := COALESCE(new.raw_user_meta_data ->> 'last_name', '');
  raw_full_name := COALESCE(new.raw_user_meta_data ->> 'full_name', '');
  
  -- If first/last not provided but full_name is, parse it
  IF raw_first_name = '' AND raw_full_name != '' THEN
    raw_first_name := TRIM(split_part(raw_full_name, ' ', 1));
  END IF;
  
  IF raw_last_name = '' AND raw_full_name != '' AND position(' ' in raw_full_name) > 0 THEN
    raw_last_name := TRIM(substring(raw_full_name from position(' ' in raw_full_name) + 1));
  END IF;
  
  -- Build full_name if not provided
  IF raw_full_name = '' THEN
    raw_full_name := TRIM(raw_first_name || ' ' || raw_last_name);
  END IF;

  INSERT INTO public.profiles (
    id, 
    email, 
    full_name,
    first_name,
    last_name,
    state
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(NULLIF(raw_full_name, ''), new.email),
    raw_first_name,
    raw_last_name,
    new.raw_user_meta_data ->> 'state'
  );
  RETURN new;
END;
$$;