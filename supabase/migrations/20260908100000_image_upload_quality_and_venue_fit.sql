-- Image upload reliability and venue image presentation controls.
-- Idempotent: safe to paste into the Supabase SQL editor more than once.

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS logo_image_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS cover_image_fit text NOT NULL DEFAULT 'cover';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'venues_logo_image_fit_check'
       AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_logo_image_fit_check
      CHECK (logo_image_fit IN ('cover', 'contain'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'venues_cover_image_fit_check'
       AND conrelid = 'public.venues'::regclass
  ) THEN
    ALTER TABLE public.venues
      ADD CONSTRAINT venues_cover_image_fit_check
      CHECK (cover_image_fit IN ('cover', 'contain'));
  END IF;
END
$$;

COMMENT ON COLUMN public.venues.logo_image_fit IS
  'Controls whether the venue logo fills its frame or shows the complete image.';
COMMENT ON COLUMN public.venues.cover_image_fit IS
  'Controls whether the venue cover fills its masthead or shows the complete image.';

GRANT SELECT (logo_image_fit, cover_image_fit)
  ON public.venues TO anon, authenticated;

-- Ensure every image surface has a real public bucket and an authoritative
-- MIME/size limit. ON CONFLICT also repairs buckets created manually earlier.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('venue-logos', 'venue-logos', true, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('groups', 'groups', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('group-post-images', 'group-post-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('group-message-images', 'group-message-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Post and chat upload paths begin with the group UUID. Only an active group
-- member may upload into that folder; owners retain update/delete control over
-- the files they created.
DROP POLICY IF EXISTS "Authenticated users can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post images" ON storage.objects;
DROP POLICY IF EXISTS "Active members can upload post images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their own post images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their own post images" ON storage.objects;

CREATE POLICY "Active members can upload post images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'group-post-images'
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Owners can update their own post images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'group-post-images'
    AND auth.uid()::text = owner_id
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'group-post-images'
    AND auth.uid()::text = owner_id
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Owners can delete their own post images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'group-post-images'
    AND auth.uid()::text = owner_id
  );

DROP POLICY IF EXISTS "Authenticated users can upload message images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own message images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own message images" ON storage.objects;
DROP POLICY IF EXISTS "Active members can upload message images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their own message images" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their own message images" ON storage.objects;

CREATE POLICY "Active members can upload message images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'group-message-images'
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Owners can update their own message images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'group-message-images'
    AND auth.uid()::text = owner_id
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'group-message-images'
    AND auth.uid()::text = owner_id
    AND public.is_group_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "Owners can delete their own message images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'group-message-images'
    AND auth.uid()::text = owner_id
  );
