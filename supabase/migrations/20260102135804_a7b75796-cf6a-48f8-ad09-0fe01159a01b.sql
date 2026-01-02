-- Create user_recent_locations table for storing custom locations
CREATE TABLE public.user_recent_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  used_at TIMESTAMPTZ DEFAULT now(),
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE public.user_recent_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_recent_locations
CREATE POLICY "Users can view their own locations"
ON public.user_recent_locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations"
ON public.user_recent_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations"
ON public.user_recent_locations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
ON public.user_recent_locations FOR DELETE
USING (auth.uid() = user_id);

-- Create guest_match_players table for temporary guest players
CREATE TABLE public.guest_match_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  notes TEXT,
  team INTEGER NOT NULL CHECK (team IN (1, 2)),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_match_players ENABLE ROW LEVEL SECURITY;

-- RLS policies for guest_match_players
CREATE POLICY "Users can view guest players in their matches"
ON public.guest_match_players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.created_by = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.match_participants mp
    WHERE mp.match_id = guest_match_players.match_id AND mp.player_id = auth.uid()
  )
);

CREATE POLICY "Match creators can insert guest players"
ON public.guest_match_players FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND m.created_by = auth.uid()
  )
);

-- Add match_format column to matches table
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_format TEXT DEFAULT 'doubles' CHECK (match_format IN ('singles', 'doubles'));

-- Modify match_participants to support guest players
ALTER TABLE public.match_participants 
  ALTER COLUMN player_id DROP NOT NULL;

ALTER TABLE public.match_participants 
  ADD COLUMN IF NOT EXISTS guest_player_id UUID REFERENCES public.guest_match_players(id) ON DELETE SET NULL;

-- Add constraint: must have either player_id OR guest_player_id
ALTER TABLE public.match_participants 
  ADD CONSTRAINT participant_has_player 
  CHECK (player_id IS NOT NULL OR guest_player_id IS NOT NULL);