-- Create court_checkins table for tracking user check-ins
CREATE TABLE IF NOT EXISTS court_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  CONSTRAINT valid_end_time CHECK (ends_at > created_at)
);

-- Create index for faster queries
CREATE INDEX idx_court_checkins_court_active ON court_checkins(court_id, ends_at) 
  WHERE checked_out_at IS NULL;
CREATE INDEX idx_court_checkins_user ON court_checkins(user_id);
CREATE INDEX idx_court_checkins_created_at ON court_checkins(created_at);

-- Enable RLS
ALTER TABLE court_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view check-ins"
  ON court_checkins FOR SELECT
  USING (true);

CREATE POLICY "Users can check in"
  ON court_checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their check-ins"
  ON court_checkins FOR UPDATE
  USING (auth.uid() = user_id);

-- Create LFG posts table
CREATE TABLE IF NOT EXISTS lfg_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id UUID NOT NULL REFERENCES courts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  skill_min NUMERIC NOT NULL DEFAULT 2.5,
  skill_max NUMERIC NOT NULL DEFAULT 4.0,
  format TEXT NOT NULL DEFAULT 'doubles',
  capacity INTEGER NOT NULL DEFAULT 4,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  CONSTRAINT valid_time_range CHECK (ends_at > starts_at),
  CONSTRAINT valid_skill_range CHECK (skill_max >= skill_min),
  CONSTRAINT valid_capacity CHECK (capacity > 0 AND capacity <= 20),
  CONSTRAINT valid_status CHECK (status IN ('open', 'full', 'cancelled', 'completed'))
);

-- Create indexes
CREATE INDEX idx_lfg_posts_court ON lfg_posts(court_id);
CREATE INDEX idx_lfg_posts_status_time ON lfg_posts(status, starts_at);
CREATE INDEX idx_lfg_posts_skill ON lfg_posts(skill_min, skill_max);

-- Enable RLS
ALTER TABLE lfg_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view open LFG posts"
  ON lfg_posts FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create LFG posts"
  ON lfg_posts FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update their LFG posts"
  ON lfg_posts FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their LFG posts"
  ON lfg_posts FOR DELETE
  USING (auth.uid() = created_by);

-- Create LFG RSVPs table
CREATE TABLE IF NOT EXISTS lfg_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lfg_id UUID NOT NULL REFERENCES lfg_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'maybe',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lfg_id, user_id),
  CONSTRAINT valid_rsvp_status CHECK (status IN ('yes', 'no', 'maybe'))
);

-- Create indexes
CREATE INDEX idx_lfg_rsvps_post ON lfg_rsvps(lfg_id);
CREATE INDEX idx_lfg_rsvps_user ON lfg_rsvps(user_id);
CREATE INDEX idx_lfg_rsvps_status ON lfg_rsvps(status);

-- Enable RLS
ALTER TABLE lfg_rsvps ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view RSVPs"
  ON lfg_rsvps FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can RSVP"
  ON lfg_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their RSVPs"
  ON lfg_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their RSVPs"
  ON lfg_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- Add trigger for updating updated_at
CREATE TRIGGER update_lfg_posts_updated_at
  BEFORE UPDATE ON lfg_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_lfg_rsvps_updated_at
  BEFORE UPDATE ON lfg_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE court_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE lfg_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE lfg_rsvps;