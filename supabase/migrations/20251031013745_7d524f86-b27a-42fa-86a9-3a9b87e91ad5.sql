-- Add games_per_player column to round_robin_events table
ALTER TABLE round_robin_events 
ADD COLUMN IF NOT EXISTS games_per_player INTEGER DEFAULT 3;

-- Add comment
COMMENT ON COLUMN round_robin_events.games_per_player IS 'Target number of games each player should play';