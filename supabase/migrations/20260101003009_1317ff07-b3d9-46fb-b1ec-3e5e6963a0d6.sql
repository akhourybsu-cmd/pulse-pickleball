-- Create group-files storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-files',
  'group-files',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- RLS Policy: Anyone can view files (bucket is public)
CREATE POLICY "Anyone can view group files"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-files');

-- RLS Policy: Group members can upload files
CREATE POLICY "Group members can upload files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-files'
  AND auth.uid() IS NOT NULL
  AND is_group_member(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- RLS Policy: File uploaders and admins can delete files
CREATE POLICY "Uploaders and admins can delete files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-files'
  AND (
    auth.uid()::text = owner_id::text
    OR is_group_admin(auth.uid(), (storage.foldername(name))[1]::uuid)
  )
);

-- Create group_post_participants table for LFG join functionality
CREATE TABLE IF NOT EXISTS public.group_post_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid NOT NULL REFERENCES public.group_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'joined',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Enable RLS on group_post_participants
ALTER TABLE public.group_post_participants ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view participants
CREATE POLICY "Members can view participants"
ON public.group_post_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM group_posts
    WHERE group_posts.id = group_post_participants.post_id
    AND is_group_member(auth.uid(), group_posts.group_id)
  )
);

-- RLS: Members can join LFG posts
CREATE POLICY "Members can join posts"
ON public.group_post_participants FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM group_posts
    WHERE group_posts.id = group_post_participants.post_id
    AND is_group_member(auth.uid(), group_posts.group_id)
  )
);

-- RLS: Users can remove themselves
CREATE POLICY "Users can leave posts"
ON public.group_post_participants FOR DELETE
USING (auth.uid() = user_id);

-- Create group_messages table for chat
CREATE TABLE IF NOT EXISTS public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on group_messages
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view messages
CREATE POLICY "Members can view messages"
ON public.group_messages FOR SELECT
USING (is_group_member(auth.uid(), group_id));

-- RLS: Members can send messages
CREATE POLICY "Members can send messages"
ON public.group_messages FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND is_group_member(auth.uid(), group_id)
);

-- RLS: Users can delete own messages
CREATE POLICY "Users can delete own messages"
ON public.group_messages FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for group_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;