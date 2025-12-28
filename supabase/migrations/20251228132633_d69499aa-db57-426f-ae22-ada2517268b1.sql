-- =============================================
-- PULSE COMMUNITY HUB - DATABASE SCHEMA
-- =============================================

-- 1. Create Enums for Group Types
CREATE TYPE public.group_type AS ENUM ('crew', 'league', 'open_play', 'venue_official', 'tournament');
CREATE TYPE public.group_visibility AS ENUM ('public', 'unlisted', 'private');
CREATE TYPE public.group_join_method AS ENUM ('open', 'request_to_join', 'invite_only');
CREATE TYPE public.group_role AS ENUM ('owner', 'moderator', 'member');

-- 2. Main Groups Table
CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type public.group_type NOT NULL DEFAULT 'crew',
  visibility public.group_visibility NOT NULL DEFAULT 'unlisted',
  join_method public.group_join_method NOT NULL DEFAULT 'open',
  invite_code text UNIQUE,
  cover_url text,
  icon_url text,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  court_id uuid REFERENCES public.courts(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  settings jsonb DEFAULT '{"allow_member_posts": true, "require_post_approval": false}'::jsonb,
  member_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Group Members Table
CREATE TABLE public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'member',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'banned')),
  last_read_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(group_id, user_id)
);

-- 4. Group Posts Table
CREATE TABLE public.group_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'feed' CHECK (type IN ('feed', 'lfg', 'announcement', 'highlight', 'poll')),
  title text,
  content text,
  pinned boolean DEFAULT false,
  session_date date,
  session_time time,
  max_players integer,
  image_url text,
  poll_options jsonb,
  last_activity_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 5. Group Post Reactions Table
CREATE TABLE public.group_post_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- 6. Group Post Comments Table
CREATE TABLE public.group_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.group_post_comments(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. Group Events Table (Schedule)
CREATE TABLE public.group_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  location_type text CHECK (location_type IN ('court', 'venue', 'custom')),
  court_id uuid REFERENCES public.courts(id) ON DELETE SET NULL,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  custom_location text,
  capacity integer,
  skill_level_min numeric,
  skill_level_max numeric,
  is_recurring boolean DEFAULT false,
  recurring_rule text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 8. Group Event RSVPs Table
CREATE TABLE public.group_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.group_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going', 'waitlist')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- 9. Group Files Table
CREATE TABLE public.group_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_type text,
  file_size integer,
  created_at timestamptz DEFAULT now()
);

-- 10. Group Invites Table (for tracking/audit)
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invite_code text,
  uses_remaining integer,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to check if user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id 
      AND group_id = _group_id 
      AND status = 'active'
  )
$$;

-- Function to check if user has a specific role in a group
CREATE OR REPLACE FUNCTION public.has_group_role(_user_id uuid, _group_id uuid, _role public.group_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id 
      AND group_id = _group_id 
      AND role = _role
      AND status = 'active'
  )
$$;

-- Function to check if user is owner or moderator of a group
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id 
      AND group_id = _group_id 
      AND role IN ('owner', 'moderator')
      AND status = 'active'
  )
$$;

-- Function to generate a unique invite code
CREATE OR REPLACE FUNCTION public.generate_group_invite_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_exists boolean;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    v_code := upper(substr(md5(random()::text), 1, 4) || '-' || substr(md5(random()::text), 1, 4));
    
    -- Check if it already exists
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE invite_code = v_code) INTO v_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_code;
END;
$$;

-- Trigger to auto-generate invite code on group creation
CREATE OR REPLACE FUNCTION public.set_group_invite_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code := generate_group_invite_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_group_invite_code
  BEFORE INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_group_invite_code();

-- Trigger to update member count
CREATE OR REPLACE FUNCTION public.update_group_member_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.groups
    SET member_count = (
      SELECT COUNT(*) FROM public.group_members
      WHERE group_id = NEW.group_id AND status = 'active'
    )
    WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.groups
    SET member_count = (
      SELECT COUNT(*) FROM public.group_members
      WHERE group_id = OLD.group_id AND status = 'active'
    )
    WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_update_group_member_count
  AFTER INSERT OR UPDATE OR DELETE ON public.group_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_member_count();

-- Trigger to auto-add creator as owner
CREATE OR REPLACE FUNCTION public.add_group_creator_as_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'owner', 'active');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_add_group_creator_as_owner
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.add_group_creator_as_owner();

-- Trigger to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_group_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_updated_at();

CREATE TRIGGER trigger_group_posts_updated_at
  BEFORE UPDATE ON public.group_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_updated_at();

CREATE TRIGGER trigger_group_events_updated_at
  BEFORE UPDATE ON public.group_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_group_updated_at();

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

-- =============================================
-- GROUPS TABLE POLICIES
-- =============================================

-- Anyone can view public groups
CREATE POLICY "Anyone can view public groups"
  ON public.groups FOR SELECT
  USING (visibility = 'public');

-- Members can view their groups (including unlisted/private)
CREATE POLICY "Members can view their groups"
  ON public.groups FOR SELECT
  USING (is_group_member(auth.uid(), id));

-- Authenticated users can create groups
CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only group owner can update group
CREATE POLICY "Owners can update their groups"
  ON public.groups FOR UPDATE
  USING (has_group_role(auth.uid(), id, 'owner'));

-- Only group owner can delete group
CREATE POLICY "Owners can delete their groups"
  ON public.groups FOR DELETE
  USING (has_group_role(auth.uid(), id, 'owner'));

-- =============================================
-- GROUP MEMBERS TABLE POLICIES
-- =============================================

-- Members can view member list of their groups
CREATE POLICY "Members can view group members"
  ON public.group_members FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

-- Public groups: anyone can view members
CREATE POLICY "Anyone can view public group members"
  ON public.group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND visibility = 'public'
    )
  );

-- Users can join groups (insert themselves)
CREATE POLICY "Users can join groups"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Admins can add members
CREATE POLICY "Admins can add members"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (is_group_admin(auth.uid(), group_id));

-- Users can leave groups (delete themselves)
CREATE POLICY "Users can leave groups"
  ON public.group_members FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can remove members
CREATE POLICY "Admins can remove members"
  ON public.group_members FOR DELETE
  USING (is_group_admin(auth.uid(), group_id));

-- Admins can update member roles/status
CREATE POLICY "Admins can update members"
  ON public.group_members FOR UPDATE
  USING (is_group_admin(auth.uid(), group_id));

-- Users can update their own membership (e.g., last_read_at)
CREATE POLICY "Users can update own membership"
  ON public.group_members FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- GROUP POSTS TABLE POLICIES
-- =============================================

-- Members can view posts in their groups
CREATE POLICY "Members can view group posts"
  ON public.group_posts FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

-- Public groups: anyone can view posts
CREATE POLICY "Anyone can view public group posts"
  ON public.group_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND visibility = 'public'
    )
  );

-- Members can create posts
CREATE POLICY "Members can create posts"
  ON public.group_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND is_group_member(auth.uid(), group_id)
  );

-- Users can update their own posts
CREATE POLICY "Users can update own posts"
  ON public.group_posts FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can update any post (for pinning, etc.)
CREATE POLICY "Admins can update posts"
  ON public.group_posts FOR UPDATE
  USING (is_group_admin(auth.uid(), group_id));

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts"
  ON public.group_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any post
CREATE POLICY "Admins can delete posts"
  ON public.group_posts FOR DELETE
  USING (is_group_admin(auth.uid(), group_id));

-- =============================================
-- GROUP POST REACTIONS TABLE POLICIES
-- =============================================

-- Members can view reactions
CREATE POLICY "Members can view reactions"
  ON public.group_post_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts
      WHERE id = post_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Public group posts: anyone can view reactions
CREATE POLICY "Anyone can view public post reactions"
  ON public.group_post_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts gp
      JOIN public.groups g ON g.id = gp.group_id
      WHERE gp.id = post_id AND g.visibility = 'public'
    )
  );

-- Members can add reactions
CREATE POLICY "Members can add reactions"
  ON public.group_post_reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.group_posts
      WHERE id = post_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
  ON public.group_post_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- GROUP POST COMMENTS TABLE POLICIES
-- =============================================

-- Members can view comments
CREATE POLICY "Members can view comments"
  ON public.group_post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts
      WHERE id = post_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Public group posts: anyone can view comments
CREATE POLICY "Anyone can view public post comments"
  ON public.group_post_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts gp
      JOIN public.groups g ON g.id = gp.group_id
      WHERE gp.id = post_id AND g.visibility = 'public'
    )
  );

-- Members can create comments
CREATE POLICY "Members can create comments"
  ON public.group_post_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.group_posts
      WHERE id = post_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
  ON public.group_post_comments FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON public.group_post_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can delete any comment
CREATE POLICY "Admins can delete comments"
  ON public.group_post_comments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.group_posts
      WHERE id = post_id AND is_group_admin(auth.uid(), group_id)
    )
  );

-- =============================================
-- GROUP EVENTS TABLE POLICIES
-- =============================================

-- Members can view events in their groups
CREATE POLICY "Members can view group events"
  ON public.group_events FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

-- Public groups: anyone can view events
CREATE POLICY "Anyone can view public group events"
  ON public.group_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND visibility = 'public'
    )
  );

-- Members can create events
CREATE POLICY "Members can create events"
  ON public.group_events FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by 
    AND is_group_member(auth.uid(), group_id)
  );

-- Event creators can update their events
CREATE POLICY "Creators can update own events"
  ON public.group_events FOR UPDATE
  USING (auth.uid() = created_by);

-- Admins can update any event
CREATE POLICY "Admins can update events"
  ON public.group_events FOR UPDATE
  USING (is_group_admin(auth.uid(), group_id));

-- Event creators can delete their events
CREATE POLICY "Creators can delete own events"
  ON public.group_events FOR DELETE
  USING (auth.uid() = created_by);

-- Admins can delete any event
CREATE POLICY "Admins can delete events"
  ON public.group_events FOR DELETE
  USING (is_group_admin(auth.uid(), group_id));

-- =============================================
-- GROUP EVENT RSVPS TABLE POLICIES
-- =============================================

-- Members can view RSVPs for events in their groups
CREATE POLICY "Members can view event RSVPs"
  ON public.group_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_events
      WHERE id = event_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Public groups: anyone can view RSVPs
CREATE POLICY "Anyone can view public event RSVPs"
  ON public.group_event_rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_events ge
      JOIN public.groups g ON g.id = ge.group_id
      WHERE ge.id = event_id AND g.visibility = 'public'
    )
  );

-- Members can RSVP to events
CREATE POLICY "Members can RSVP to events"
  ON public.group_event_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM public.group_events
      WHERE id = event_id AND is_group_member(auth.uid(), group_id)
    )
  );

-- Users can update their own RSVPs
CREATE POLICY "Users can update own RSVPs"
  ON public.group_event_rsvps FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own RSVPs
CREATE POLICY "Users can delete own RSVPs"
  ON public.group_event_rsvps FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================
-- GROUP FILES TABLE POLICIES
-- =============================================

-- Members can view files in their groups
CREATE POLICY "Members can view group files"
  ON public.group_files FOR SELECT
  USING (is_group_member(auth.uid(), group_id));

-- Public groups: anyone can view files
CREATE POLICY "Anyone can view public group files"
  ON public.group_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND visibility = 'public'
    )
  );

-- Members can upload files
CREATE POLICY "Members can upload files"
  ON public.group_files FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploader_id 
    AND is_group_member(auth.uid(), group_id)
  );

-- Uploaders can delete their own files
CREATE POLICY "Uploaders can delete own files"
  ON public.group_files FOR DELETE
  USING (auth.uid() = uploader_id);

-- Admins can delete any file
CREATE POLICY "Admins can delete files"
  ON public.group_files FOR DELETE
  USING (is_group_admin(auth.uid(), group_id));

-- =============================================
-- GROUP INVITES TABLE POLICIES
-- =============================================

-- Admins can view invites
CREATE POLICY "Admins can view invites"
  ON public.group_invites FOR SELECT
  USING (is_group_admin(auth.uid(), group_id));

-- Admins can create invites
CREATE POLICY "Admins can create invites"
  ON public.group_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by 
    AND is_group_admin(auth.uid(), group_id)
  );

-- Admins can delete invites
CREATE POLICY "Admins can delete invites"
  ON public.group_invites FOR DELETE
  USING (is_group_admin(auth.uid(), group_id));

-- =============================================
-- ENABLE REALTIME
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.group_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_event_rsvps;

-- =============================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX idx_groups_visibility ON public.groups(visibility);
CREATE INDEX idx_groups_invite_code ON public.groups(invite_code);
CREATE INDEX idx_groups_created_by ON public.groups(created_by);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_status ON public.group_members(status);
CREATE INDEX idx_group_posts_group_id ON public.group_posts(group_id);
CREATE INDEX idx_group_posts_created_at ON public.group_posts(created_at DESC);
CREATE INDEX idx_group_events_group_id ON public.group_events(group_id);
CREATE INDEX idx_group_events_start_time ON public.group_events(start_time);
CREATE INDEX idx_group_files_group_id ON public.group_files(group_id);