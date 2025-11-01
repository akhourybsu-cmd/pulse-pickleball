-- Tournament Portal Phase 1: Events Schema
-- This creates a separate namespace for tournament management

-- Create enum for tournament status
CREATE TYPE tournament_status AS ENUM ('draft', 'upcoming', 'live', 'completed', 'cancelled');

-- Main events table
CREATE TABLE tournaments_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status tournament_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Enable RLS
ALTER TABLE tournaments_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admin-only access
CREATE POLICY "Admins can view all tournament events"
  ON tournaments_events FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create tournament events"
  ON tournaments_events FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "Admins can update tournament events"
  ON tournaments_events FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete tournament events"
  ON tournaments_events FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER tournaments_events_updated_at
  BEFORE UPDATE ON tournaments_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Create placeholder tables for future phases (structure only, no data)
-- These will be fully implemented in later phases

CREATE TABLE tournaments_courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES tournaments_events(id) ON DELETE CASCADE,
  court_number INTEGER NOT NULL,
  court_name TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, court_number)
);

ALTER TABLE tournaments_courts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tournament courts"
  ON tournaments_courts FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Index for performance
CREATE INDEX idx_tournaments_events_status ON tournaments_events(status);
CREATE INDEX idx_tournaments_events_dates ON tournaments_events(start_date, end_date);
CREATE INDEX idx_tournaments_events_created_by ON tournaments_events(created_by);
CREATE INDEX idx_tournaments_courts_event ON tournaments_courts(event_id);