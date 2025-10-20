-- Create enum for event status
CREATE TYPE public.round_robin_status AS ENUM ('draft', 'live', 'completed');

-- Create enum for rating type
CREATE TYPE public.rating_type AS ENUM ('ladder', 'league', 'playoffs', 'casual');

-- Round Robin Events table
CREATE TABLE public.round_robin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  organizer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notes TEXT,
  rating_eligible BOOLEAN NOT NULL DEFAULT true,
  rating_type rating_type NOT NULL DEFAULT 'league',
  num_courts INTEGER NOT NULL CHECK (num_courts >= 1),
  num_rounds INTEGER NOT NULL CHECK (num_rounds >= 1),
  status round_robin_status NOT NULL DEFAULT 'draft',
  current_round INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Round Robin Players table
CREATE TABLE public.round_robin_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.round_robin_events(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true,
  bye_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(event_id, player_id)
);

-- Round Robin Schedule table
CREATE TABLE public.round_robin_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.round_robin_events(id) ON DELETE CASCADE,
  round_no INTEGER NOT NULL CHECK (round_no >= 1),
  court_no INTEGER NOT NULL CHECK (court_no >= 1),
  a1_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  a2_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  b1_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  b2_player_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_bye BOOLEAN NOT NULL DEFAULT false,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, round_no, court_no)
);

-- Add round_no and court_no to matches table for round robin context
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS round_no INTEGER,
  ADD COLUMN IF NOT EXISTS court_no INTEGER,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Enable RLS
ALTER TABLE public.round_robin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_robin_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.round_robin_schedule ENABLE ROW LEVEL SECURITY;

-- RLS Policies for round_robin_events
CREATE POLICY "Organizers can manage their events"
  ON public.round_robin_events
  FOR ALL
  USING (auth.uid() = organizer_id);

CREATE POLICY "Participants can view their events"
  ON public.round_robin_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_players
      WHERE event_id = round_robin_events.id
        AND player_id = auth.uid()
    )
    OR auth.uid() = organizer_id
  );

CREATE POLICY "Admins can view all events"
  ON public.round_robin_events
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for round_robin_players
CREATE POLICY "Organizers can manage event players"
  ON public.round_robin_players
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_events
      WHERE id = round_robin_players.event_id
        AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Participants can view event players"
  ON public.round_robin_players
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_events
      WHERE id = round_robin_players.event_id
        AND (organizer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.round_robin_players rp2
          WHERE rp2.event_id = round_robin_players.event_id
            AND rp2.player_id = auth.uid()
        ))
    )
  );

-- RLS Policies for round_robin_schedule
CREATE POLICY "Organizers can manage event schedule"
  ON public.round_robin_schedule
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_events
      WHERE id = round_robin_schedule.event_id
        AND organizer_id = auth.uid()
    )
  );

CREATE POLICY "Participants can view event schedule"
  ON public.round_robin_schedule
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.round_robin_events rre
      WHERE rre.id = round_robin_schedule.event_id
        AND (rre.organizer_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.round_robin_players rrp
          WHERE rrp.event_id = round_robin_schedule.event_id
            AND rrp.player_id = auth.uid()
        ))
    )
  );

-- Indexes for performance
CREATE INDEX idx_round_robin_players_event ON public.round_robin_players(event_id);
CREATE INDEX idx_round_robin_players_player ON public.round_robin_players(player_id);
CREATE INDEX idx_round_robin_schedule_event_round ON public.round_robin_schedule(event_id, round_no);
CREATE INDEX idx_matches_event_round_court ON public.matches(event_id, round_no, court_no) WHERE event_id IS NOT NULL;

-- Trigger to update updated_at
CREATE TRIGGER update_round_robin_events_updated_at
  BEFORE UPDATE ON public.round_robin_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();