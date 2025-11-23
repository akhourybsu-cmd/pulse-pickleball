-- Add state column to profiles table for signup state selection
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS state TEXT;

-- Update the handle_new_user trigger to include state from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, state)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player'),
    NEW.raw_user_meta_data->>'state'
  );
  RETURN NEW;
END;
$$;