CREATE POLICY "Anyone can view group message images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'group-message-images');

CREATE POLICY "Authenticated users can upload message images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'group-message-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own message images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'group-message-images' AND auth.uid()::text = owner_id);

CREATE POLICY "Users can delete their own message images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'group-message-images' AND auth.uid()::text = owner_id);