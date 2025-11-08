-- Remove organizer_pin column from round_robin_events table
ALTER TABLE round_robin_events DROP COLUMN IF EXISTS organizer_pin;