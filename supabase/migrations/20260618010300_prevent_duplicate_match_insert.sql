-- =====================================================================
-- Server-side double-submit guard on matches (Phase 2.A.4).
--
-- The client now early-returns when isSubmitting is true, but that
-- doesn't cover:
--   • Two browser tabs simultaneously hitting submit on the same form.
--   • A reload mid-submit followed by a re-submit attempt.
--   • A multi-step insert that partially fails (matches insert OK,
--     participants insert fails, user retries → duplicate match row).
--
-- A short-window trigger rejects identical inserts from the same
-- creator within 30 seconds. The window is intentionally tight so
-- legitimate "I played two 11–0 games against the same opponent in
-- the same session" isn't accidentally blocked — those will be more
-- than 30s apart in practice. The error code is 23505 (unique
-- violation) so the client can map it to a friendly toast.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.prevent_duplicate_match_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    -- Backend / migration / admin imports don't have a created_by;
    -- skip the dedupe check.
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.matches m
     WHERE m.created_by = NEW.created_by
       AND m.match_date = NEW.match_date
       AND m.team1_score IS NOT DISTINCT FROM NEW.team1_score
       AND m.team2_score IS NOT DISTINCT FROM NEW.team2_score
       AND m.match_type  IS NOT DISTINCT FROM NEW.match_type
       AND COALESCE(m.court_id::text, '') = COALESCE(NEW.court_id::text, '')
       AND m.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate match — an identical match was recorded in the last 30 seconds. If you meant to record a second game, wait a moment and try again.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_match_insert ON public.matches;
CREATE TRIGGER prevent_duplicate_match_insert
BEFORE INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_match_insert();

COMMENT ON TRIGGER prevent_duplicate_match_insert ON public.matches IS
  'Phase 2.A.4 — rejects duplicate match inserts from the same '
  'creator within 30 seconds (same date, scores, type, court). '
  'Catches the double-submit race the client guard can''t cover.';
