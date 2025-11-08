-- Fix the notify_home_court_post function to not reference non-existent type field
CREATE OR REPLACE FUNCTION notify_home_court_post()
RETURNS TRIGGER AS $$
DECLARE
  v_author_name TEXT;
  v_post_type TEXT;
BEGIN
  -- Get author's name
  SELECT COALESCE(display_name, full_name, 'Someone')
  INTO v_author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Determine post type based on fields
  IF NEW.session_date IS NOT NULL AND NEW.max_players IS NOT NULL THEN
    v_post_type := 'LFG';
  ELSE
    v_post_type := 'post';
  END IF;
  
  -- Notify all users who have this as their home court (except the post author)
  INSERT INTO user_notifications (user_id, notification_type, title, message, link)
  SELECT 
    p.id,
    'court_activity',
    v_author_name || ' posted a ' || v_post_type,
    LEFT(COALESCE(NEW.content, NEW.title, 'New post'), 100) || CASE WHEN LENGTH(COALESCE(NEW.content, NEW.title, '')) > 100 THEN '...' ELSE '' END,
    '/court/board/' || NEW.court_id
  FROM profiles p
  WHERE p.home_court_id = NEW.court_id
    AND p.id != NEW.user_id;  -- Don't notify the post author
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;