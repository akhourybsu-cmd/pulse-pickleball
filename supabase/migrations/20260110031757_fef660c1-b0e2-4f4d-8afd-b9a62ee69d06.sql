-- Phase 1: System Integrity - Canonical Data Contracts & State Machines
-- (Fixed: Using venue_staff instead of venue_admins)

-- ============================================
-- 1. PLAYER STATE ENUM & COLUMN
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.player_state AS ENUM ('onboarding', 'active', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS player_state public.player_state DEFAULT 'onboarding';

-- Backfill existing players based on match history
UPDATE public.profiles p
SET player_state = 'active'
WHERE player_state = 'onboarding'
AND EXISTS (
  SELECT 1 FROM public.match_participants mp 
  WHERE mp.player_id = p.id
);

-- ============================================
-- 2. VENUE ACTIVATION STATE ENUM & COLUMN
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.venue_activation_state AS ENUM ('claimed', 'pending', 'active', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS activation_state public.venue_activation_state DEFAULT 'claimed';

-- Backfill based on existing data
UPDATE public.venues v
SET activation_state = CASE
  WHEN EXISTS (
    SELECT 1 FROM public.unified_events e 
    WHERE e.host_venue_id = v.id AND e.is_published = true
  ) THEN 'active'::public.venue_activation_state
  WHEN v.tagline IS NOT NULL OR v.description IS NOT NULL 
    THEN 'pending'::public.venue_activation_state
  ELSE 'claimed'::public.venue_activation_state
END;

-- ============================================
-- 3. MATCH SOURCE & VERIFICATION STATUS
-- ============================================
DO $$ BEGIN
  CREATE TYPE public.match_source AS ENUM ('manual', 'round_robin', 'tournament', 'league', 'import');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add verification_status if not exists (for manual match validation)
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';

-- Add check constraint for verification_status values
DO $$ BEGIN
  ALTER TABLE public.matches
  ADD CONSTRAINT matches_verification_status_check 
  CHECK (verification_status IN ('pending', 'verified', 'disputed', 'rejected'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 4. STATE MACHINE TRIGGER: Player State
-- ============================================
CREATE OR REPLACE FUNCTION public.update_player_state_on_match()
RETURNS TRIGGER AS $$
BEGIN
  -- When a match is completed, update player states to active
  UPDATE public.profiles
  SET player_state = 'active'
  WHERE id IN (
    SELECT player_id FROM public.match_participants 
    WHERE match_id = NEW.id AND player_id IS NOT NULL
  )
  AND player_state = 'onboarding';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_update_player_state ON public.matches;
CREATE TRIGGER trigger_update_player_state
AFTER INSERT ON public.matches
FOR EACH ROW
WHEN (NEW.status IS NULL OR NEW.status = 'completed')
EXECUTE FUNCTION public.update_player_state_on_match();

-- ============================================
-- 5. STATE MACHINE TRIGGER: Venue Activation
-- ============================================
CREATE OR REPLACE FUNCTION public.update_venue_activation_state()
RETURNS TRIGGER AS $$
BEGIN
  -- When a venue event is published, activate the venue
  IF NEW.host_venue_id IS NOT NULL AND NEW.is_published = true THEN
    UPDATE public.venues
    SET activation_state = 'active'
    WHERE id = NEW.host_venue_id
    AND activation_state != 'active';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_venue_activation ON public.unified_events;
CREATE TRIGGER trigger_venue_activation
AFTER INSERT OR UPDATE OF is_published ON public.unified_events
FOR EACH ROW
WHEN (NEW.host_venue_id IS NOT NULL)
EXECUTE FUNCTION public.update_venue_activation_state();

-- ============================================
-- 6. STATE MACHINE TRIGGER: Event Status Validation
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_event_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  valid_transitions JSONB := '{
    "draft": ["published", "cancelled"],
    "published": ["registration_open", "in_progress", "cancelled"],
    "registration_open": ["registration_closed", "in_progress", "cancelled"],
    "registration_closed": ["in_progress", "cancelled"],
    "in_progress": ["completed", "cancelled"],
    "completed": [],
    "cancelled": []
  }'::JSONB;
  allowed_next TEXT[];
BEGIN
  -- Only validate if status is actually changing
  IF OLD.status IS NOT NULL AND NEW.status IS NOT NULL AND NEW.status != OLD.status THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(valid_transitions->OLD.status))
    INTO allowed_next;
    
    IF array_length(allowed_next, 1) > 0 AND NOT (NEW.status = ANY(allowed_next)) THEN
      RAISE EXCEPTION 'Invalid event status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_validate_event_status ON public.unified_events;
CREATE TRIGGER trigger_validate_event_status
BEFORE UPDATE OF status ON public.unified_events
FOR EACH ROW
EXECUTE FUNCTION public.validate_event_status_transition();

-- ============================================
-- 7. MATCH VALIDATION: Prevent Duplicates
-- ============================================
CREATE OR REPLACE FUNCTION public.prevent_duplicate_event_matches()
RETURNS TRIGGER AS $$
BEGIN
  -- Only check for event-based matches
  IF NEW.event_id IS NOT NULL AND NEW.round_no IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.event_id = NEW.event_id
      AND m.round_no = NEW.round_no
      AND m.court_no = NEW.court_no
      AND m.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND m.voided IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'Duplicate match detected: same event, round, and court';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prevent_duplicate_matches ON public.matches;
CREATE TRIGGER trigger_prevent_duplicate_matches
BEFORE INSERT OR UPDATE ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_event_matches();

-- ============================================
-- 8. Update venue discovery RLS (using venue_staff table)
-- ============================================
DROP POLICY IF EXISTS "Active venues visible to all" ON public.venues;
CREATE POLICY "Active venues visible to all"
ON public.venues FOR SELECT
USING (
  activation_state = 'active' 
  OR owner_id = auth.uid()
  OR id IN (SELECT venue_id FROM public.venue_staff WHERE user_id = auth.uid())
);