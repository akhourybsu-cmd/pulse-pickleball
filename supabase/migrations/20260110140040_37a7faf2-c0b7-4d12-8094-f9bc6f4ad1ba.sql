-- Add wizard metadata columns to venue_inquiries table
ALTER TABLE venue_inquiries 
ADD COLUMN IF NOT EXISTS venue_type text,
ADD COLUMN IF NOT EXISTS primary_goals text[],
ADD COLUMN IF NOT EXISTS current_setup text,
ADD COLUMN IF NOT EXISTS timeline text,
ADD COLUMN IF NOT EXISTS event_volume text;