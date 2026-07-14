
-- ============================================================================
-- Slice 1: Data model for participant lifecycle & schedule protection
-- ============================================================================

-- 1. Participant status enum
DO $$ BEGIN
  CREATE TYPE public.rr_participant_status AS ENUM (
    'active',
    'withdrawn',
    'injured',
    'removed',
    'replaced'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. round_robin_players: participant lifecycle columns
ALTER TABLE public.round_robin_players
  ADD COLUMN IF NOT EXISTS status public.rr_participant_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz,
  ADD COLUMN IF NOT EXISTS withdrawal_reason text,
  ADD COLUMN IF NOT EXISTS effective_round integer,
  ADD COLUMN IF NOT EXISTS replacement_participant_id uuid REFERENCES public.round_robin_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replaced_participant_id uuid REFERENCES public.round_robin_players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill: anyone previously marked withdrawn via registration_status becomes 'withdrawn'
UPDATE public.round_robin_players
SET status = 'withdrawn',
    withdrawn_at = COALESCE(withdrawn_at, now())
WHERE registration_status = 'withdrawn'
  AND status = 'active';

-- Anyone with active=false but not registration_status='withdrawn' → 'removed'
UPDATE public.round_robin_players
SET status = 'removed',
    withdrawn_at = COALESCE(withdrawn_at, now())
WHERE active = false
  AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_rrp_status ON public.round_robin_players(event_id, status);

-- 3. round_robin_events: optimistic concurrency version
ALTER TABLE public.round_robin_events
  ADD COLUMN IF NOT EXISTS schedule_version integer NOT NULL DEFAULT 0;

-- 4. round_robin_schedule: match protection
ALTER TABLE public.round_robin_schedule
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS abandoned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS abandoned_reason text,
  ADD COLUMN IF NOT EXISTS abandoned_at timestamptz,
  ADD COLUMN IF NOT EXISTS original_schedule_id uuid REFERENCES public.round_robin_schedule(id) ON DELETE SET NULL;

-- Backfill: any match that already has a score is considered locked/completed
UPDATE public.round_robin_schedule
SET locked_at = COALESCE(locked_at, now())
WHERE (team1_score IS NOT NULL OR team2_score IS NOT NULL)
  AND locked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_rr_schedule_locked ON public.round_robin_schedule(event_id, locked_at);

-- 5. round_robin_audit: ensure change_type covers new participant actions.
-- The `change_type` column is TEXT (free-form), so no schema change needed;
-- we standardize on these values in code:
--   'participant_withdrew', 'participant_injured', 'participant_removed',
--   'participant_replaced', 'participant_restored',
--   'schedule_regenerated', 'match_abandoned', 'match_restarted'

COMMENT ON COLUMN public.round_robin_players.status IS
  'Participant lifecycle: active | withdrawn | injured | removed | replaced. Never hard-delete after event start.';
COMMENT ON COLUMN public.round_robin_events.schedule_version IS
  'Monotonically increasing counter bumped by every schedule mutation. Used for optimistic concurrency control.';
COMMENT ON COLUMN public.round_robin_schedule.locked_at IS
  'When set, this match is protected from schedule regeneration (in progress, completed, or verified).';
COMMENT ON COLUMN public.round_robin_schedule.abandoned IS
  'True when a mid-match withdrawal voided this match. The row is preserved for history.';

-- 6. Trigger to auto-update updated_at on players
CREATE OR REPLACE FUNCTION public.rr_players_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rrp_touch_updated_at ON public.round_robin_players;
CREATE TRIGGER trg_rrp_touch_updated_at
BEFORE UPDATE ON public.round_robin_players
FOR EACH ROW EXECUTE FUNCTION public.rr_players_touch_updated_at();
