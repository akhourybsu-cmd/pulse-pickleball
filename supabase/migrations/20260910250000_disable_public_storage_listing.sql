-- Public buckets serve files by URL without a storage.objects SELECT policy.
-- These broad policies therefore add directory-listing access without being
-- required by getPublicUrl() or by the app's upload/delete flows.

DROP POLICY IF EXISTS "Anyone can view group files"
  ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view group message images"
  ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view group post images"
  ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view venue logos"
  ON storage.objects;

DROP POLICY IF EXISTS "Avatar images are publicly accessible"
  ON storage.objects;

DROP POLICY IF EXISTS "Group avatars are publicly accessible"
  ON storage.objects;

DROP POLICY IF EXISTS "Public can view tournament assets"
  ON storage.objects;
