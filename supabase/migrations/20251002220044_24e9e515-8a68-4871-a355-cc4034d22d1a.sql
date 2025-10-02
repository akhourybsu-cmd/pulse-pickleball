-- Add unique constraint to ensure only one active session per court at a time
CREATE UNIQUE INDEX unique_active_session_per_court 
ON public.sessions (court_id) 
WHERE status = 'active';

COMMENT ON INDEX unique_active_session_per_court IS 'Ensures only one active session can exist per court at any given time';