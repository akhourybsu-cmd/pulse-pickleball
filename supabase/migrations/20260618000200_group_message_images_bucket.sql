-- =====================================================================
-- Storage bucket for chat-attached images (Community Phase 2.4).
--
-- useGroupChat.ts uploads attachments via useImageUpload({
--   bucket: 'group-message-images', folder: groupId
-- }), which uses .getPublicUrl() — so the bucket must be public-read.
--
-- We compensate with a tight INSERT policy: a writer must be an active
-- member of the group whose UUID prefixes the path. This blocks
-- cross-group writes (a member of Group A can't drop files into
-- Group B's folder) without breaking the existing public-URL render
-- path in chat.
--
-- A future hardening pass can switch to private bucket + signed URLs;
-- that requires client-side URL refresh and is out of scope for the
-- Phase 1 reliability fix.
-- =====================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'group-message-images',
  'group-message-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Public read — matches the existing group-post-images bucket. The
-- file names are time + random suffix UUIDs so URLs are effectively
-- unguessable; this is the standard trade-off used elsewhere in the
-- app.
DROP POLICY IF EXISTS "Anyone can view group message images" ON storage.objects;
CREATE POLICY "Anyone can view group message images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-message-images');

-- Write: must be an authenticated active member of the group whose
-- UUID is the first path segment. The uploader's user_id is stored
-- in owner (auth.uid()::text) for the UPDATE/DELETE policies below.
DROP POLICY IF EXISTS "Group members can upload message images" ON storage.objects;
CREATE POLICY "Group members can upload message images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'group-message-images'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
        FROM public.group_members gm
       WHERE gm.user_id  = auth.uid()
         AND gm.status   = 'active'
         -- Path is "<group_id>/<filename>"; cast first segment to UUID
         -- and match against group_members.group_id. The split_part
         -- returns '' when there is no slash, which UUID-casts to
         -- null and trivially fails the equality.
         AND gm.group_id::text = split_part(name, '/', 1)
    )
  );

DROP POLICY IF EXISTS "Users can update their own message images" ON storage.objects;
CREATE POLICY "Users can update their own message images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'group-message-images'
    AND (auth.uid())::text = owner_id
  );

DROP POLICY IF EXISTS "Users can delete their own message images" ON storage.objects;
CREATE POLICY "Users can delete their own message images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'group-message-images'
    AND (auth.uid())::text = owner_id
  );
