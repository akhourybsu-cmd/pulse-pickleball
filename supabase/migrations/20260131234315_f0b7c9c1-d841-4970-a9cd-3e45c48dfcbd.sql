-- Create storage bucket for group post images
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-post-images', 'group-post-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Anyone can view group post images (public bucket)
CREATE POLICY "Anyone can view group post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'group-post-images');

-- RLS: Authenticated users can upload images
CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'group-post-images' 
  AND auth.role() = 'authenticated'
);

-- RLS: Users can update their own images
CREATE POLICY "Users can update their own post images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'group-post-images' 
  AND (auth.uid())::text = owner_id
);

-- RLS: Users can delete their own images
CREATE POLICY "Users can delete their own post images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'group-post-images' 
  AND (auth.uid())::text = owner_id
);