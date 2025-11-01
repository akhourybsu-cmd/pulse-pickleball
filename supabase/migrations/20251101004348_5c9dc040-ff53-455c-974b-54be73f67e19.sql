-- Add match workflow tracking columns to tournaments_matches
ALTER TABLE tournaments_matches
ADD COLUMN actual_duration_minutes INTEGER,
ADD COLUMN notes TEXT,
ADD COLUMN score_edited_by UUID REFERENCES auth.users(id),
ADD COLUMN score_edited_at TIMESTAMP WITH TIME ZONE;

-- Add status enum to tournaments_divisions
CREATE TYPE division_status AS ENUM ('draft', 'active', 'completed');

ALTER TABLE tournaments_divisions
ADD COLUMN status division_status NOT NULL DEFAULT 'draft';