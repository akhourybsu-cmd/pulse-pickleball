-- Add contested matches tracking table
CREATE TABLE IF NOT EXISTS public.contested_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  contested_by uuid NOT NULL REFERENCES public.profiles(id),
  reason text,
  contested_at timestamp with time zone NOT NULL DEFAULT now(),
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES public.profiles(id)
);

-- Enable RLS
ALTER TABLE public.contested_matches ENABLE ROW LEVEL SECURITY;

-- RLS policies for contested_matches
CREATE POLICY "Users can view contested matches they're involved in"
ON public.contested_matches
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = contested_matches.match_id
    AND mp.player_id = auth.uid()
  )
);

CREATE POLICY "Users can contest matches they participated in"
ON public.contested_matches
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM match_participants mp
    WHERE mp.match_id = contested_matches.match_id
    AND mp.player_id = auth.uid()
  )
  AND contested_by = auth.uid()
);

-- Add index for performance
CREATE INDEX idx_contested_matches_match_id ON public.contested_matches(match_id);
CREATE INDEX idx_contested_matches_resolved ON public.contested_matches(resolved);