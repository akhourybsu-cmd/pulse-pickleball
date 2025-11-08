-- Function to notify users about new comments in their home court
CREATE OR REPLACE FUNCTION notify_home_court_comment()
RETURNS TRIGGER AS $$
DECLARE
  v_post RECORD;
  v_court_id UUID;
  v_post_author_id UUID;
  v_commenter_name TEXT;
BEGIN
  -- Get post details including court_id and author
  SELECT cp.court_id, cp.user_id, cp.type
  INTO v_post
  FROM court_posts cp
  WHERE cp.id = NEW.post_id;
  
  v_court_id := v_post.court_id;
  v_post_author_id := v_post.user_id;
  
  -- Get commenter's name
  SELECT COALESCE(display_name, full_name, 'Someone')
  INTO v_commenter_name
  FROM profiles
  WHERE id = NEW.author_user_id;
  
  -- Notify all users who have this as their home court (except the commenter)
  INSERT INTO user_notifications (user_id, notification_type, title, message, link)
  SELECT 
    p.id,
    'court_activity',
    v_commenter_name || ' commented on a ' || v_post.type || ' post',
    LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
    '/court/board/' || v_court_id
  FROM profiles p
  WHERE p.home_court_id = v_court_id
    AND p.id != NEW.author_user_id  -- Don't notify the commenter
    AND p.id != v_post_author_id;   -- Don't notify post author (they might get separate notification)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new comments
DROP TRIGGER IF EXISTS on_court_post_comment_created ON court_post_comments;
CREATE TRIGGER on_court_post_comment_created
  AFTER INSERT ON court_post_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_home_court_comment();