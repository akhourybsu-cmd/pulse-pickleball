-- Forfeit handling
ALTER TABLE tournaments_matches 
ADD COLUMN IF NOT EXISTS forfeit_team_id UUID REFERENCES tournaments_teams(id),
ADD COLUMN IF NOT EXISTS forfeit_reason TEXT;

-- Dispute tracking
ALTER TABLE tournaments_matches 
ADD COLUMN IF NOT EXISTS disputed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS dispute_notes TEXT,
ADD COLUMN IF NOT EXISTS dispute_resolved_by UUID,
ADD COLUMN IF NOT EXISTS dispute_resolved_at TIMESTAMPTZ;

-- Check-in
ALTER TABLE tournament_registrations 
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS check_in_notes TEXT;