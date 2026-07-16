-- Slice 2b sync: keep round_robin_players.active in lock-step with status.
-- The transactional rr_manage_participant RPC only updates `status`, but
-- large parts of the app still filter rosters on the legacy boolean
-- `active`. Without this trigger the two columns drift, which would defeat
-- the whole point of routing organizer mutations through the RPC.

CREATE OR REPLACE FUNCTION public.rr_sync_active_from_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  -- Only touch `active` when `status` actually changed, so legacy code that
  -- toggles `active` directly (add player / reactivate) still works during
  -- the migration window.
  IF TG_OP = 'INSERT' THEN
    NEW.active := (NEW.status = 'active');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.active := (NEW.status = 'active');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rr_sync_active_from_status ON public.round_robin_players;
CREATE TRIGGER trg_rr_sync_active_from_status
BEFORE INSERT OR UPDATE OF status ON public.round_robin_players
FOR EACH ROW
EXECUTE FUNCTION public.rr_sync_active_from_status();

-- Backfill any pre-existing drift (rows where status was set by the RPC
-- during Slice 2a hardening but active never followed).
UPDATE public.round_robin_players
   SET active = (status = 'active')
 WHERE active <> (status = 'active');
