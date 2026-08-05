CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can view their own device tokens"
ON public.device_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can insert their own device tokens"
ON public.device_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can update their own device tokens"
ON public.device_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can delete their own device tokens"
ON public.device_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_device_tokens_updated_at ON public.device_tokens;
CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- Lock first/last name once confirmed.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_locked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first text := NULLIF(trim(NEW.raw_user_meta_data->>'first_name'), '');
  v_last  text := NULLIF(trim(NEW.raw_user_meta_data->>'last_name'), '');
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, first_name, last_name, name_locked)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player'),
      v_first,
      v_last,
      (v_first IS NOT NULL AND v_last IS NOT NULL)
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_name_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.name_locked IS TRUE THEN
    NEW.first_name := OLD.first_name;
    NEW.last_name  := OLD.last_name;
    NEW.full_name  := OLD.full_name;
    NEW.name_locked := TRUE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_name_lock_trigger ON public.profiles;
CREATE TRIGGER enforce_name_lock_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_name_lock();