-- Create scoring rulesets table
CREATE TABLE IF NOT EXISTS tournaments_scoring_rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  games_to INTEGER NOT NULL DEFAULT 11,
  win_by_2 BOOLEAN NOT NULL DEFAULT true,
  best_of INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create divisions table
CREATE TABLE IF NOT EXISTS tournaments_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tournaments_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  format TEXT NOT NULL DEFAULT 'round_robin',
  scoring_ruleset_id UUID REFERENCES tournaments_scoring_rulesets(id),
  max_teams INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default scoring rulesets
INSERT INTO tournaments_scoring_rulesets (name, description, games_to, win_by_2, best_of) VALUES
  ('Standard (11 pts, win by 2)', 'Standard pickleball scoring: first to 11, win by 2', 11, true, 1),
  ('Rally Scoring (15 pts)', 'Rally scoring: first to 15, win by 2', 15, true, 1),
  ('Best of 3 (11 pts)', 'Best of 3 games to 11, win by 2', 11, true, 3),
  ('Speed Format (7 pts)', 'Quick games: first to 7, win by 2', 7, true, 1);

-- Enable RLS
ALTER TABLE tournaments_scoring_rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments_divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scoring rulesets (everyone can view, admins manage)
CREATE POLICY "Everyone can view scoring rulesets"
  ON tournaments_scoring_rulesets FOR SELECT
  USING (true);

CREATE POLICY "Admins manage scoring rulesets"
  ON tournaments_scoring_rulesets FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for divisions (admins only)
CREATE POLICY "Admins can view all divisions"
  ON tournaments_divisions FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create divisions"
  ON tournaments_divisions FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update divisions"
  ON tournaments_divisions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete divisions"
  ON tournaments_divisions FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_divisions_event_id ON tournaments_divisions(event_id);
CREATE INDEX idx_divisions_scoring_ruleset ON tournaments_divisions(scoring_ruleset_id);

-- Update trigger for divisions
CREATE OR REPLACE FUNCTION update_divisions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_divisions_updated_at
  BEFORE UPDATE ON tournaments_divisions
  FOR EACH ROW
  EXECUTE FUNCTION update_divisions_updated_at();