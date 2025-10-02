-- Add comment column to court_post_participants
ALTER TABLE public.court_post_participants
ADD COLUMN comment TEXT;