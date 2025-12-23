-- Create player_favorite_venues table for tracking favorite venues
CREATE TABLE public.player_favorite_venues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, venue_id)
);

-- Enable Row Level Security
ALTER TABLE public.player_favorite_venues ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_favorite_venues
CREATE POLICY "Users can view their own favorite venues"
ON public.player_favorite_venues
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorite venues"
ON public.player_favorite_venues
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorite venues"
ON public.player_favorite_venues
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX idx_player_favorite_venues_user_id ON public.player_favorite_venues(user_id);
CREATE INDEX idx_player_favorite_venues_venue_id ON public.player_favorite_venues(venue_id);