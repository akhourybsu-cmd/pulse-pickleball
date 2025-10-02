-- Add viewed_participants tracking to court_posts to support notifications
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS viewed_participants_count INTEGER DEFAULT 0;

-- Create function to delete old court posts (posts from previous days)
CREATE OR REPLACE FUNCTION delete_old_court_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM court_posts
  WHERE session_date < CURRENT_DATE;
END;
$$;