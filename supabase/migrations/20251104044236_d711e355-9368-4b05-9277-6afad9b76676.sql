-- Add rental_status column to calendar_events table
ALTER TABLE public.calendar_events 
ADD COLUMN rental_status TEXT CHECK (rental_status IN ('available', 'reserved'));