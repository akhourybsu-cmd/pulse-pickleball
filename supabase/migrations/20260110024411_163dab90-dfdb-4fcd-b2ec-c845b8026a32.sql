-- =============================================
-- UNIFIED EVENTS MODEL - Core Schema
-- =============================================

-- 1. Core unified_events table
CREATE TABLE public.unified_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Core Event Info
  title TEXT NOT NULL,
  description TEXT,
  
  -- Event Type (polymorphic discriminator)
  event_type TEXT NOT NULL CHECK (event_type IN (
    'round_robin',
    'tournament',
    'open_play',
    'lesson',
    'clinic',
    'league',
    'social',
    'private_rental'
  )),
  
  -- Host (polymorphic)
  host_type TEXT NOT NULL CHECK (host_type IN ('individual', 'venue', 'group', 'court')),
  host_user_id UUID REFERENCES auth.users(id),
  host_venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE,
  host_group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
  host_court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE,
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  timezone TEXT DEFAULT 'America/New_York',
  
  -- Location (flexible)
  location_type TEXT CHECK (location_type IN ('venue', 'court', 'address', 'tbd')),
  venue_id UUID REFERENCES public.venues(id),
  court_id UUID REFERENCES public.courts(id),
  location_address TEXT,
  location_name TEXT,
  
  -- Capacity
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT false,
  waitlist_max INTEGER,
  
  -- Pricing
  price DECIMAL(10,2) DEFAULT 0,
  price_label TEXT,
  
  -- Skill/Rating
  skill_level TEXT,
  skill_level_min DECIMAL,
  skill_level_max DECIMAL,
  rating_eligible BOOLEAN DEFAULT false,
  rating_type TEXT CHECK (rating_type IN ('pulse', 'ladder', 'league', 'none') OR rating_type IS NULL),
  
  -- Visibility & Status
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft',
    'published',
    'registration_open',
    'registration_closed',
    'in_progress',
    'completed',
    'cancelled'
  )),
  is_published BOOLEAN DEFAULT false,
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  series_id UUID,
  recurrence_rule TEXT,
  
  -- Metadata
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Legacy Reference (for migration)
  legacy_table TEXT,
  legacy_id UUID
);

-- 2. Round Robin Extension
CREATE TABLE public.event_round_robin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.unified_events(id) ON DELETE CASCADE,
  
  format TEXT DEFAULT 'open' CHECK (format IN ('open', 'mixed', 'male', 'female', 'singles', 'doubles')),
  num_courts INTEGER NOT NULL DEFAULT 2,
  num_rounds INTEGER,
  games_per_player INTEGER,
  current_round INTEGER DEFAULT 0,
  
  registration_deadline TIMESTAMPTZ,
  registration_mode TEXT DEFAULT 'open_registration',
  
  completed_at TIMESTAMPTZ,
  voided BOOLEAN DEFAULT false,
  voided_by UUID REFERENCES auth.users(id),
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(event_id)
);

-- 3. Tournament Extension
CREATE TABLE public.event_tournament (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.unified_events(id) ON DELETE CASCADE,
  
  registration_open_date TIMESTAMPTZ,
  registration_close_date TIMESTAMPTZ,
  registration_fee DECIMAL(10,2),
  registration_enabled BOOLEAN DEFAULT false,
  
  public_view_enabled BOOLEAN DEFAULT true,
  divisions_count INTEGER DEFAULT 0,
  
  payment_status TEXT,
  stripe_checkout_session_id TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(event_id)
);

-- 4. Lesson/Clinic Extension
CREATE TABLE public.event_instruction (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.unified_events(id) ON DELETE CASCADE,
  
  instructor_name TEXT,
  instructor_id UUID REFERENCES auth.users(id),
  coach_id UUID REFERENCES public.venue_coaches(id),
  
  focus_areas TEXT[],
  equipment_provided BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(event_id)
);

-- 5. Unified Registrations Table
CREATE TABLE public.event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.unified_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'confirmed',
    'waitlisted',
    'cancelled',
    'checked_in',
    'no_show'
  )),
  
  team_id UUID,
  team_role TEXT,
  
  registered_at TIMESTAMPTZ DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  waitlist_position INTEGER,
  promoted_at TIMESTAMPTZ,
  
  notes TEXT,
  
  UNIQUE(event_id, user_id)
);

-- 6. Indexes for performance
CREATE INDEX idx_unified_events_host_venue ON public.unified_events(host_venue_id) WHERE host_venue_id IS NOT NULL;
CREATE INDEX idx_unified_events_host_group ON public.unified_events(host_group_id) WHERE host_group_id IS NOT NULL;
CREATE INDEX idx_unified_events_host_court ON public.unified_events(host_court_id) WHERE host_court_id IS NOT NULL;
CREATE INDEX idx_unified_events_start_time ON public.unified_events(start_time);
CREATE INDEX idx_unified_events_status ON public.unified_events(status);
CREATE INDEX idx_unified_events_event_type ON public.unified_events(event_type);
CREATE INDEX idx_unified_events_legacy ON public.unified_events(legacy_table, legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX idx_event_registrations_user ON public.event_registrations(user_id);
CREATE INDEX idx_event_registrations_event ON public.event_registrations(event_id);
CREATE INDEX idx_event_registrations_status ON public.event_registrations(status);

-- 7. Browse Events View
CREATE OR REPLACE VIEW public.v_browse_events AS
SELECT 
  e.id,
  e.title,
  e.description,
  e.event_type,
  e.host_type,
  e.host_user_id,
  e.host_venue_id,
  e.host_group_id,
  e.host_court_id,
  e.start_time,
  e.end_time,
  e.timezone,
  e.location_type,
  e.venue_id,
  e.court_id,
  e.location_address,
  e.location_name,
  e.max_participants,
  e.current_participants,
  e.waitlist_enabled,
  e.price,
  e.price_label,
  e.skill_level,
  e.rating_eligible,
  e.visibility,
  e.status,
  e.is_published,
  e.created_at,
  
  -- Host info
  CASE e.host_type
    WHEN 'individual' THEN p.full_name
    WHEN 'venue' THEN v.name
    WHEN 'group' THEN g.name
    WHEN 'court' THEN c.name
  END as host_name,
  
  -- Location display
  COALESCE(
    loc_v.name,
    loc_c.name,
    e.location_name,
    e.location_address
  ) as display_location,
  
  -- Registration counts
  (SELECT COUNT(*) FROM public.event_registrations r 
   WHERE r.event_id = e.id AND r.status = 'confirmed') as confirmed_count,
  (SELECT COUNT(*) FROM public.event_registrations r 
   WHERE r.event_id = e.id AND r.status = 'waitlisted') as waitlist_count

FROM public.unified_events e
LEFT JOIN public.profiles p ON e.host_user_id = p.id
LEFT JOIN public.venues v ON e.host_venue_id = v.id
LEFT JOIN public.groups g ON e.host_group_id = g.id
LEFT JOIN public.courts c ON e.host_court_id = c.id
LEFT JOIN public.venues loc_v ON e.venue_id = loc_v.id
LEFT JOIN public.courts loc_c ON e.court_id = loc_c.id;

-- 8. Enable RLS
ALTER TABLE public.unified_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_round_robin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_tournament ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_instruction ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for unified_events

-- Public can view published events
CREATE POLICY "Public can view published events"
  ON public.unified_events FOR SELECT
  USING (is_published = true AND visibility = 'public');

-- Creators can view their own events
CREATE POLICY "Creators can view own events"
  ON public.unified_events FOR SELECT
  USING (created_by = auth.uid());

-- Venue staff can view venue events
CREATE POLICY "Venue staff can view venue events"
  ON public.unified_events FOR SELECT
  USING (
    host_venue_id IS NOT NULL AND
    has_venue_access(auth.uid(), host_venue_id)
  );

-- Group members can view group events
CREATE POLICY "Group members can view group events"
  ON public.unified_events FOR SELECT
  USING (
    host_group_id IS NOT NULL AND
    is_group_member(auth.uid(), host_group_id)
  );

-- Creators can insert events
CREATE POLICY "Users can create events"
  ON public.unified_events FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Creators can update their events
CREATE POLICY "Creators can update own events"
  ON public.unified_events FOR UPDATE
  USING (created_by = auth.uid());

-- Venue staff can update venue events
CREATE POLICY "Venue staff can update venue events"
  ON public.unified_events FOR UPDATE
  USING (
    host_venue_id IS NOT NULL AND
    has_venue_access(auth.uid(), host_venue_id)
  );

-- Group admins can update group events
CREATE POLICY "Group admins can update group events"
  ON public.unified_events FOR UPDATE
  USING (
    host_group_id IS NOT NULL AND
    is_group_admin(auth.uid(), host_group_id)
  );

-- Creators can delete their events
CREATE POLICY "Creators can delete own events"
  ON public.unified_events FOR DELETE
  USING (created_by = auth.uid());

-- Venue staff can delete venue events
CREATE POLICY "Venue staff can delete venue events"
  ON public.unified_events FOR DELETE
  USING (
    host_venue_id IS NOT NULL AND
    has_venue_access(auth.uid(), host_venue_id)
  );

-- 10. RLS Policies for extension tables (inherit from parent)

-- event_round_robin
CREATE POLICY "View round robin extension"
  ON public.event_round_robin FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
    )
  );

CREATE POLICY "Manage round robin extension"
  ON public.event_round_robin FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR has_venue_access(auth.uid(), e.host_venue_id))
    )
  );

-- event_tournament
CREATE POLICY "View tournament extension"
  ON public.event_tournament FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
    )
  );

CREATE POLICY "Manage tournament extension"
  ON public.event_tournament FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR has_venue_access(auth.uid(), e.host_venue_id))
    )
  );

-- event_instruction
CREATE POLICY "View instruction extension"
  ON public.event_instruction FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
    )
  );

CREATE POLICY "Manage instruction extension"
  ON public.event_instruction FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR has_venue_access(auth.uid(), e.host_venue_id))
    )
  );

-- 11. RLS Policies for event_registrations

-- Users can view registrations for events they can see
CREATE POLICY "View event registrations"
  ON public.event_registrations FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR has_venue_access(auth.uid(), e.host_venue_id))
    )
  );

-- Users can register themselves
CREATE POLICY "Users can register for events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own registration
CREATE POLICY "Users can update own registration"
  ON public.event_registrations FOR UPDATE
  USING (user_id = auth.uid());

-- Event hosts can update registrations
CREATE POLICY "Hosts can update registrations"
  ON public.event_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.unified_events e
      WHERE e.id = event_id
      AND (e.created_by = auth.uid() OR has_venue_access(auth.uid(), e.host_venue_id))
    )
  );

-- Users can cancel their registration
CREATE POLICY "Users can cancel own registration"
  ON public.event_registrations FOR DELETE
  USING (user_id = auth.uid());

-- 12. Update triggers
CREATE TRIGGER update_unified_events_updated_at
  BEFORE UPDATE ON public.unified_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_event_round_robin_updated_at
  BEFORE UPDATE ON public.event_round_robin
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_event_tournament_updated_at
  BEFORE UPDATE ON public.event_tournament
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_event_instruction_updated_at
  BEFORE UPDATE ON public.event_instruction
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 13. Function to sync registration count
CREATE OR REPLACE FUNCTION public.sync_unified_event_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE unified_events
    SET current_participants = (
      SELECT COUNT(*) FROM event_registrations
      WHERE event_id = NEW.event_id AND status IN ('confirmed', 'checked_in')
    )
    WHERE id = NEW.event_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE unified_events
    SET current_participants = (
      SELECT COUNT(*) FROM event_registrations
      WHERE event_id = OLD.event_id AND status IN ('confirmed', 'checked_in')
    )
    WHERE id = OLD.event_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_unified_event_participants_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_unified_event_participants();