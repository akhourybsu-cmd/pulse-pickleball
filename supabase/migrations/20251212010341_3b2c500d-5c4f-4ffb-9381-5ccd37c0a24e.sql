-- Add type column to explicitly categorize posts
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS type text DEFAULT 'feed' CHECK (type IN ('feed', 'lfg', 'highlight', 'announcement'));

-- Add pinned flag for admin announcements
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false;

-- Add last_activity_at for bump logic
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- Add LFG-specific optional fields
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS lfg_skill_min numeric;
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS lfg_skill_max numeric;
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS lfg_format text CHECK (lfg_format IN ('singles', 'doubles', 'either'));
ALTER TABLE court_posts ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Make session_date, session_time, max_players nullable for non-LFG posts
ALTER TABLE court_posts ALTER COLUMN session_date DROP NOT NULL;
ALTER TABLE court_posts ALTER COLUMN session_time DROP NOT NULL;
ALTER TABLE court_posts ALTER COLUMN max_players DROP NOT NULL;

-- Set default type based on existing data (posts with max_players > 0 are LFG)
UPDATE court_posts SET type = 'lfg' WHERE max_players IS NOT NULL AND max_players > 0;

-- Create function to update last_activity_at on parent post
CREATE OR REPLACE FUNCTION update_post_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE court_posts 
  SET last_activity_at = now() 
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for comments and reactions
DROP TRIGGER IF EXISTS update_post_activity_on_comment ON court_post_comments;
CREATE TRIGGER update_post_activity_on_comment
  AFTER INSERT ON court_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_last_activity();

DROP TRIGGER IF EXISTS update_post_activity_on_reaction ON court_post_reactions;
CREATE TRIGGER update_post_activity_on_reaction
  AFTER INSERT ON court_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_post_last_activity();