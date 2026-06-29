-- =====================================================================
-- Harden handle_new_user() — idempotent profile creation on signup.
--
-- The original trigger (migration 20251001182832) does a bare INSERT
-- into public.profiles when an auth.users row appears. Any failure
-- (duplicate id, NOT NULL violation on a future column, RLS edge)
-- aborts the auth.users insert and the signup fails outright.
--
-- This rewrite:
--   • Uses ON CONFLICT (id) DO NOTHING so retries / replays don't
--     break the signup.
--   • Wraps the body in an EXCEPTION block that logs (RAISE LOG) and
--     RETURNS NEW even on failure, so the auth signup can still
--     complete. A client-side fallback (added in the same phase)
--     creates the missing profile if the trigger silently skipped.
--   • Preserves the existing behavior of pulling full_name from
--     raw_user_meta_data and falling back to 'Player'.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', 'Player')
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Don't abort the auth signup if profile creation fails — the
    -- client-side ensureProfileExists() in useAuthState will retry
    -- once the user actually lands in the app. Log so the deployer
    -- can spot constraint regressions in Postgres logs.
    RAISE LOG 'handle_new_user: profile insert failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
