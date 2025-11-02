-- Add new contact fields to tournament_customization table
ALTER TABLE public.tournament_customization 
ADD COLUMN IF NOT EXISTS organizer_phone TEXT,
ADD COLUMN IF NOT EXISTS organizer_preferred_contact TEXT DEFAULT 'email',
ADD COLUMN IF NOT EXISTS organizer_message TEXT;