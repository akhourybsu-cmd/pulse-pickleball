-- =====================================================================
-- Auto-fire recalculate_all_ratings() on match approval boundary
-- transitions (Phase 2.A.3).
--
-- The existing handle_match_status_change trigger (migration
-- 20251001202644) calls recalculate_player_stats per participant when
-- status crosses the 'approved' boundary, but it does NOT call the
-- system-wide recalculate_all_ratings function. That means newly
-- approved matches end up with rating_change=NULL in
-- match_participants until someone manually runs the recalc.
--
-- This migration adds a focused trigger that fires the rating engine
-- whenever a row enters or leaves 'approved' status. Coexists with the
-- existing trigger; both are AFTER triggers and don't share state.
--
-- recalculate_all_ratings is intentionally expensive (walks every
-- approved match). For low-volume recreational use this is
-- acceptable; if/when scale demands it, a future change can replace
-- this with an incremental rating update keyed on the match in
-- question.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_match_approval_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT path — a new row created directly in approved status.
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'approved' AND COALESCE(NEW.voided, false) = false THEN
      PERFORM recalculate_all_ratings();
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE path — only when the approved/voided boundary actually
  -- moved. Status edits within 'approved' (e.g., a score correction)
  -- don't need a full chain rebuild here; that's a separate optimization.
  IF TG_OP = 'UPDATE' THEN
    IF (
         -- Status crossed the approved line.
         OLD.status IS DISTINCT FROM NEW.status
         AND ('approved' IN (OLD.status, NEW.status))
       )
       OR (
         -- Voided flag flipped while approved.
         OLD.voided IS DISTINCT FROM NEW.voided
         AND NEW.status = 'approved'
       )
       OR (
         -- count_for_rating flipped on an approved match.
         OLD.count_for_rating IS DISTINCT FROM NEW.count_for_rating
         AND NEW.status = 'approved'
       )
    THEN
      PERFORM recalculate_all_ratings();
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_approval_recalc ON public.matches;
CREATE TRIGGER on_match_approval_recalc
AFTER INSERT OR UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.handle_match_approval_recalc();

COMMENT ON TRIGGER on_match_approval_recalc ON public.matches IS
  'Phase 2.A.3 — fires recalculate_all_ratings() when a match enters '
  'or leaves the approved+rating-eligible state. Required because the '
  'existing handle_match_status_change trigger only refreshes stats, '
  'not the system-wide rating chain.';
