-- Create storage bucket for venue logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('venue-logos', 'venue-logos', true);

-- Allow venue owners/managers to upload logos for their venue
CREATE POLICY "Venue admins can upload logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'venue-logos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM venue_staff vs
    WHERE vs.user_id = auth.uid()
    AND vs.venue_id::text = (storage.foldername(name))[1]
    AND vs.role IN ('owner', 'manager')
  )
);

-- Allow venue admins to update their logos
CREATE POLICY "Venue admins can update logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'venue-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM venue_staff vs
    WHERE vs.user_id = auth.uid()
    AND vs.venue_id::text = (storage.foldername(name))[1]
    AND vs.role IN ('owner', 'manager')
  )
);

-- Allow venue admins to delete their logos
CREATE POLICY "Venue admins can delete logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'venue-logos'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM venue_staff vs
    WHERE vs.user_id = auth.uid()
    AND vs.venue_id::text = (storage.foldername(name))[1]
    AND vs.role IN ('owner', 'manager')
  )
);

-- Allow public read access to venue logos
CREATE POLICY "Anyone can view venue logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'venue-logos');