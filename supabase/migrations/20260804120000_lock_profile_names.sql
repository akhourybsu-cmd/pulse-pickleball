-- =====================================================================
-- Lock first/last name once confirmed.
--
-- Product model ("lock after confirm"):
--   • NEW signups have their name locked immediately — the identity of
--     record (first_name / last_name) is frozen from day one.
--   • EXISTING users stay editable until they confirm their name once;
--     the confirm action flips name_locked false -> true and freezes it.
--   • display_name is never affected — it stays freely editable so players
--     can still control how they appear on leaderboards.
--
-- Enforcement is at the database level, not just the UI: a BEFORE UPDATE
-- guard preserves first/last (and blocks un-locking) for ordinary
-- authenticated callers once name_locked is true. Privileged roles
-- (service_role / admin tooling) bypass the guard, so a genuine typo or
-- legal name change can still be corrected out-of-band.
-- =====================================================================

-- 1. The lock flag. Existing rows default to false (not yet confirmed).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS name_locked boolean NOT NULL DEFAULT false;

-- 2. New signups: copy first/last from auth metadata and lock immediately,
--    but only when we actually have a name to lock. Partial/OAuth signups
--    with no name stay unlocked so the player can fill it in and confirm.
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
    -- Never abort the auth signup if profile creation fails; the client
    -- fallback recreates the profile once the user lands in the app.
    RAISE LOG 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 3. Guard: once locked, freeze first/last and disallow un-locking for
--    non-privileged callers. Runs as SECURITY INVOKER so current_user
--    reflects the PostgREST role (authenticated / anon) of the request.
CREATE OR REPLACE FUNCTION public.enforce_name_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admin / backend tooling can always correct names.
  IF current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF OLD.name_locked IS TRUE THEN
    -- Silently preserve the frozen identity so unrelated profile updates
    -- (display_name, avatar, location, ...) still succeed, and prevent a
    -- client from flipping the lock back off.
    NEW.first_name := OLD.first_name;
    NEW.last_name  := OLD.last_name;
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
