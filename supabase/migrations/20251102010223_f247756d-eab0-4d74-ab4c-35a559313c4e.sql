-- Add scheduled_time column to tournaments_matches
ALTER TABLE tournaments_matches 
ADD COLUMN scheduled_time TIMESTAMPTZ NULL;

-- Add index for scheduled_time queries
CREATE INDEX idx_tournaments_matches_scheduled_time 
ON tournaments_matches(division_id, scheduled_time) 
WHERE scheduled_time IS NOT NULL;