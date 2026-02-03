-- Phase 1A: Add new columns to tournaments_divisions for comprehensive division configuration
ALTER TABLE public.tournaments_divisions
ADD COLUMN IF NOT EXISTS skill_level_min DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS skill_level_max DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS age_group TEXT,
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('men', 'women', 'mixed', 'open')),
ADD COLUMN IF NOT EXISTS play_type TEXT CHECK (play_type IN ('singles', 'doubles', 'mixed_doubles')),
ADD COLUMN IF NOT EXISTS registration_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS early_bird_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS early_bird_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS estimated_match_duration INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS min_teams INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS scheduled_start_time TIME,
ADD COLUMN IF NOT EXISTS scheduled_day INTEGER DEFAULT 1;

-- Phase 1B: Create tournament_event_settings table for advanced event configuration
CREATE TABLE IF NOT EXISTS public.tournament_event_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.tournaments_events(id) ON DELETE CASCADE UNIQUE,
  
  -- Registration Controls
  max_events_per_player INTEGER DEFAULT 3,
  max_events_per_day INTEGER,
  require_partner_account BOOLEAN DEFAULT false,
  require_emergency_contact BOOLEAN DEFAULT true,
  require_full_address BOOLEAN DEFAULT false,
  allow_same_format_multiple BOOLEAN DEFAULT false,
  
  -- Player Score Entry
  allow_player_score_entry BOOLEAN DEFAULT false,
  score_auto_confirm_minutes INTEGER DEFAULT 3,
  
  -- Check-in Settings
  check_in_window_hours INTEGER DEFAULT 1,
  require_match_ready_confirm BOOLEAN DEFAULT false,
  
  -- Scheduling
  default_match_duration INTEGER DEFAULT 30,
  court_transition_minutes INTEGER DEFAULT 5,
  
  -- Communication
  auto_email_on_register BOOLEAN DEFAULT true,
  auto_email_on_payment BOOLEAN DEFAULT true,
  auto_email_court_assignment BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,
  
  -- Age Determination
  age_determination_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on tournament_event_settings
ALTER TABLE public.tournament_event_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tournament_event_settings
CREATE POLICY "Event settings are viewable by everyone"
ON public.tournament_event_settings
FOR SELECT
USING (true);

CREATE POLICY "Event organizers can manage settings"
ON public.tournament_event_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.tournaments_events te
    WHERE te.id = event_id AND te.created_by = auth.uid()
  )
);

-- Add seeding columns to tournaments_teams
ALTER TABLE public.tournaments_teams
ADD COLUMN IF NOT EXISTS seed_source TEXT CHECK (seed_source IN ('manual', 'pulse_rating', 'dupr', 'random')),
ADD COLUMN IF NOT EXISTS seed_locked BOOLEAN DEFAULT false;

-- Add player score entry columns to tournaments_matches
ALTER TABLE public.tournaments_matches
ADD COLUMN IF NOT EXISTS player_score_submitted_by UUID,
ADD COLUMN IF NOT EXISTS player_score_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS opponent_confirmed BOOLEAN,
ADD COLUMN IF NOT EXISTS opponent_confirmed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auto_confirmed BOOLEAN DEFAULT false;

-- Create trigger for updated_at on tournament_event_settings
CREATE OR REPLACE FUNCTION public.update_tournament_event_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_tournament_event_settings_updated_at ON public.tournament_event_settings;
CREATE TRIGGER update_tournament_event_settings_updated_at
BEFORE UPDATE ON public.tournament_event_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_tournament_event_settings_updated_at();