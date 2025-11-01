-- Create teams table
CREATE TABLE IF NOT EXISTS tournaments_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournaments_divisions(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  seed_number INTEGER,
  player1_id UUID REFERENCES profiles(id),
  player2_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_seed_per_division UNIQUE(division_id, seed_number),
  CONSTRAINT different_players CHECK (player1_id IS NULL OR player2_id IS NULL OR player1_id != player2_id)
);

-- Create matches table
CREATE TABLE IF NOT EXISTS tournaments_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournaments_divisions(id) ON DELETE CASCADE,
  court_id UUID REFERENCES tournaments_courts(id),
  round_number INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  team1_id UUID NOT NULL REFERENCES tournaments_teams(id) ON DELETE CASCADE,
  team2_id UUID NOT NULL REFERENCES tournaments_teams(id) ON DELETE CASCADE,
  team1_score INTEGER,
  team2_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT different_teams CHECK (team1_id != team2_id)
);

-- Enable RLS
ALTER TABLE tournaments_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments_matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams (admins only)
CREATE POLICY "Admins can view all teams"
  ON tournaments_teams FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create teams"
  ON tournaments_teams FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update teams"
  ON tournaments_teams FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete teams"
  ON tournaments_teams FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for matches (admins only)
CREATE POLICY "Admins can view all matches"
  ON tournaments_matches FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create matches"
  ON tournaments_matches FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update matches"
  ON tournaments_matches FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete matches"
  ON tournaments_matches FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_teams_division_id ON tournaments_teams(division_id);
CREATE INDEX idx_teams_player1_id ON tournaments_teams(player1_id);
CREATE INDEX idx_teams_player2_id ON tournaments_teams(player2_id);
CREATE INDEX idx_matches_division_id ON tournaments_matches(division_id);
CREATE INDEX idx_matches_court_id ON tournaments_matches(court_id);
CREATE INDEX idx_matches_team1_id ON tournaments_matches(team1_id);
CREATE INDEX idx_matches_team2_id ON tournaments_matches(team2_id);

-- Update trigger for teams
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_teams_updated_at
  BEFORE UPDATE ON tournaments_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Update trigger for matches
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_matches_updated_at
  BEFORE UPDATE ON tournaments_matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_updated_at();