-- Create storage bucket for group assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('groups', 'groups', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload group avatars
CREATE POLICY "Group admins can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'groups' 
  AND auth.role() = 'authenticated'
);

-- Allow public read access to group avatars
CREATE POLICY "Group avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'groups');

-- Allow authenticated users to update/delete their uploads
CREATE POLICY "Group admins can update avatars"
ON storage.objects FOR UPDATE
USING (bucket_id = 'groups' AND auth.role() = 'authenticated');

CREATE POLICY "Group admins can delete avatars"
ON storage.objects FOR DELETE
USING (bucket_id = 'groups' AND auth.role() = 'authenticated');