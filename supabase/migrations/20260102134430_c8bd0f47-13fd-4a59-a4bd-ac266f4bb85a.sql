
-- Phase 1: Notification System Overhaul - Database Foundation

-- 1. Add new columns to user_notifications
ALTER TABLE public.user_notifications 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'system',
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS expires_at timestamptz,
ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  in_app_enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT false,
  email_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, category)
);

-- 3. Create push_subscriptions table for web push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- 4. Enable RLS on new tables
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for notification_preferences
CREATE POLICY "Users can view their own notification preferences"
ON public.notification_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification preferences"
ON public.notification_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification preferences"
ON public.notification_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification preferences"
ON public.notification_preferences FOR DELETE
USING (auth.uid() = user_id);

-- 6. RLS policies for push_subscriptions
CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

-- 7. Enable realtime for user_notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

-- 8. Create function to generate notifications
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id uuid,
  p_notification_type text,
  p_category text,
  p_title text,
  p_message text,
  p_link text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_metadata jsonb DEFAULT '{}',
  p_actor_id uuid DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
  v_prefs_enabled boolean;
BEGIN
  -- Check if user has disabled this category
  SELECT COALESCE(in_app_enabled, true) INTO v_prefs_enabled
  FROM notification_preferences
  WHERE user_id = p_user_id AND category = p_category;
  
  -- If no preference exists or in_app is enabled, create notification
  IF v_prefs_enabled IS NULL OR v_prefs_enabled = true THEN
    INSERT INTO user_notifications (
      user_id, notification_type, category, title, message, link, 
      priority, metadata, actor_id, expires_at, read
    ) VALUES (
      p_user_id, p_notification_type, p_category, p_title, p_message, p_link,
      p_priority, p_metadata, p_actor_id, p_expires_at, false
    )
    RETURNING id INTO v_notification_id;
  END IF;
  
  RETURN v_notification_id;
END;
$$;

-- 9. Trigger function for match notifications
CREATE OR REPLACE FUNCTION public.notify_match_participants()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
  v_recorder_name text;
  v_match_date text;
BEGIN
  -- Get recorder name
  SELECT display_name INTO v_recorder_name 
  FROM profiles 
  WHERE id = NEW.recorder_id;
  
  v_match_date := to_char(COALESCE(NEW.played_at, NEW.created_at), 'Mon DD');
  
  -- Notify all participants except the recorder
  FOR v_participant IN 
    SELECT mp.player_id 
    FROM match_participants mp 
    WHERE mp.match_id = NEW.id 
    AND mp.player_id != NEW.recorder_id
  LOOP
    PERFORM create_notification(
      v_participant.player_id,
      'match_recorded',
      'matches',
      'Match Recorded',
      COALESCE(v_recorder_name, 'Someone') || ' recorded a match with you',
      '/matches/' || NEW.id,
      'high',
      jsonb_build_object('match_id', NEW.id, 'team1_score', NEW.team1_score, 'team2_score', NEW.team2_score),
      NEW.recorder_id,
      now() + interval '7 days'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 10. Create match notification trigger
DROP TRIGGER IF EXISTS on_match_created_notify ON public.matches;
CREATE TRIGGER on_match_created_notify
AFTER INSERT ON public.matches
FOR EACH ROW
EXECUTE FUNCTION notify_match_participants();

-- 11. Trigger function for match verification needed
CREATE OR REPLACE FUNCTION public.notify_match_verification_needed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participant RECORD;
BEGIN
  -- When a match approval is created (not yet approved), notify the player
  IF NEW.approved IS NULL OR NEW.approved = false THEN
    PERFORM create_notification(
      NEW.player_id,
      'match_verification_needed',
      'matches',
      'Verify Match Result',
      'Please verify your recent match result',
      '/pending-matches',
      'high',
      jsonb_build_object('match_id', NEW.match_id, 'approval_id', NEW.id),
      NULL,
      now() + interval '3 days'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 12. Create match approval notification trigger
DROP TRIGGER IF EXISTS on_match_approval_created ON public.match_approvals;
CREATE TRIGGER on_match_approval_created
AFTER INSERT ON public.match_approvals
FOR EACH ROW
EXECUTE FUNCTION notify_match_verification_needed();

-- 13. Trigger function for group post notifications
CREATE OR REPLACE FUNCTION public.notify_group_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_author_name text;
  v_group_name text;
  v_notif_type text;
  v_title text;
  v_message text;
BEGIN
  -- Get author name and group name
  SELECT display_name INTO v_author_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO v_group_name FROM groups WHERE id = NEW.group_id;
  
  -- Determine notification type based on post type
  IF NEW.type = 'lfg' THEN
    v_notif_type := 'group_lfg_new';
    v_title := 'Looking for Players';
    v_message := COALESCE(v_author_name, 'Someone') || ' is looking for players in ' || COALESCE(v_group_name, 'your group');
  ELSE
    v_notif_type := 'group_post_new';
    v_title := 'New Post in ' || COALESCE(v_group_name, 'Group');
    v_message := COALESCE(v_author_name, 'Someone') || ' posted in ' || COALESCE(v_group_name, 'the group');
  END IF;
  
  -- Notify all group members except the author
  FOR v_member IN 
    SELECT gm.user_id 
    FROM group_members gm 
    WHERE gm.group_id = NEW.group_id 
    AND gm.user_id != NEW.user_id
    AND gm.status = 'active'
  LOOP
    PERFORM create_notification(
      v_member.user_id,
      v_notif_type,
      'community',
      v_title,
      v_message,
      '/community/' || NEW.group_id || '/post/' || NEW.id,
      'normal',
      jsonb_build_object('group_id', NEW.group_id, 'post_id', NEW.id, 'post_type', NEW.type),
      NEW.user_id,
      now() + interval '7 days'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- 14. Create group post notification trigger
DROP TRIGGER IF EXISTS on_group_post_created_notify ON public.group_posts;
CREATE TRIGGER on_group_post_created_notify
AFTER INSERT ON public.group_posts
FOR EACH ROW
EXECUTE FUNCTION notify_group_post_created();

-- 15. Trigger function for badge earned notifications
CREATE OR REPLACE FUNCTION public.notify_badge_earned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_name text;
  v_badge_desc text;
BEGIN
  -- Get badge info
  SELECT name, description INTO v_badge_name, v_badge_desc
  FROM badges WHERE id = NEW.badge_id;
  
  PERFORM create_notification(
    NEW.player_id,
    'badge_earned',
    'achievements',
    'Badge Earned! 🏆',
    'You earned "' || COALESCE(v_badge_name, 'a badge') || '"',
    '/profile/' || NEW.player_id,
    'normal',
    jsonb_build_object('badge_id', NEW.badge_id, 'badge_name', v_badge_name),
    NULL,
    now() + interval '30 days'
  );
  
  RETURN NEW;
END;
$$;

-- 16. Create badge earned notification trigger
DROP TRIGGER IF EXISTS on_badge_earned_notify ON public.player_badges;
CREATE TRIGGER on_badge_earned_notify
AFTER INSERT ON public.player_badges
FOR EACH ROW
EXECUTE FUNCTION notify_badge_earned();

-- 17. Trigger function for LFG participant joined
CREATE OR REPLACE FUNCTION public.notify_lfg_participant_joined()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_creator_id uuid;
  v_joiner_name text;
  v_post_title text;
  v_group_id uuid;
BEGIN
  -- Get post info
  SELECT gp.user_id, gp.title, gp.group_id 
  INTO v_post_creator_id, v_post_title, v_group_id
  FROM group_posts gp 
  WHERE gp.id = NEW.post_id;
  
  -- Don't notify if creator joined their own post
  IF v_post_creator_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get joiner name
  SELECT display_name INTO v_joiner_name FROM profiles WHERE id = NEW.user_id;
  
  PERFORM create_notification(
    v_post_creator_id,
    'group_lfg_joined',
    'community',
    'Player Joined Your Session',
    COALESCE(v_joiner_name, 'Someone') || ' joined your session',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'high',
    jsonb_build_object('post_id', NEW.post_id, 'joiner_id', NEW.user_id),
    NEW.user_id,
    now() + interval '3 days'
  );
  
  RETURN NEW;
END;
$$;

-- 18. Create LFG participant notification trigger
DROP TRIGGER IF EXISTS on_lfg_participant_joined ON public.group_post_participants;
CREATE TRIGGER on_lfg_participant_joined
AFTER INSERT ON public.group_post_participants
FOR EACH ROW
EXECUTE FUNCTION notify_lfg_participant_joined();

-- 19. Trigger function for post comments
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_author_id uuid;
  v_commenter_name text;
  v_group_id uuid;
BEGIN
  -- Get post info
  SELECT gp.user_id, gp.group_id 
  INTO v_post_author_id, v_group_id
  FROM group_posts gp 
  WHERE gp.id = NEW.post_id;
  
  -- Don't notify if commenting on own post
  IF v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;
  
  -- Get commenter name
  SELECT display_name INTO v_commenter_name FROM profiles WHERE id = NEW.user_id;
  
  PERFORM create_notification(
    v_post_author_id,
    'post_comment',
    'community',
    'New Comment',
    COALESCE(v_commenter_name, 'Someone') || ' commented on your post',
    '/community/' || v_group_id || '/post/' || NEW.post_id,
    'normal',
    jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id),
    NEW.user_id,
    now() + interval '7 days'
  );
  
  RETURN NEW;
END;
$$;

-- 20. Create post comment notification trigger
DROP TRIGGER IF EXISTS on_post_comment_notify ON public.group_post_comments;
CREATE TRIGGER on_post_comment_notify
AFTER INSERT ON public.group_post_comments
FOR EACH ROW
EXECUTE FUNCTION notify_post_comment();

-- 21. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_category ON public.user_notifications(category);
CREATE INDEX IF NOT EXISTS idx_user_notifications_priority ON public.user_notifications(priority);
CREATE INDEX IF NOT EXISTS idx_user_notifications_expires_at ON public.user_notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_category ON public.notification_preferences(user_id, category);
