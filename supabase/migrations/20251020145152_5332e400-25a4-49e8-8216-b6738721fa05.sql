-- Add score fields to round_robin_schedule
ALTER TABLE public.round_robin_schedule
ADD COLUMN team1_score INTEGER,
ADD COLUMN team2_score INTEGER;

-- Add completed status to round_robin_events
ALTER TABLE public.round_robin_events
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;