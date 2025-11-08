-- Function to notify users about new posts in their home court
CREATE OR REPLACE FUNCTION notify_home_court_post()
RETURNS TRIGGER AS $$
DECLARE
  v_author_name TEXT;
BEGIN
  -- Get author's name
  SELECT COALESCE(display_name, full_name, 'Someone')
  INTO v_author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Notify all users who have this as their home court (except the post author)
  INSERT INTO user_notifications (user_id, notification_type, title, message, link)
  SELECT 
    p.id,
    'court_activity',
    v_author_name || ' posted a ' || NEW.type,
    LEFT(COALESCE(NEW.body, NEW.title, 'New post'), 100) || CASE WHEN LENGTH(COALESCE(NEW.body, NEW.title, '')) > 100 THEN '...' ELSE '' END,
    '/court/board/' || NEW.court_id
  FROM profiles p
  WHERE p.home_court_id = NEW.court_id
    AND p.id != NEW.user_id;  -- Don't notify the post author
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new posts
DROP TRIGGER IF EXISTS on_court_post_created ON court_posts;
CREATE TRIGGER on_court_post_created
  AFTER INSERT ON court_posts
  FOR EACH ROW
  EXECUTE FUNCTION notify_home_court_post();