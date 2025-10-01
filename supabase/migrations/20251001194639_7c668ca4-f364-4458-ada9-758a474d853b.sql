-- Create courts table
CREATE TABLE IF NOT EXISTS public.courts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name, city, state)
);

-- Enable RLS on courts
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- Anyone can view courts
CREATE POLICY "Courts are viewable by everyone"
ON public.courts
FOR SELECT
USING (true);

-- Add court to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id);

-- Add match approval status
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' 
CHECK (status IN ('pending', 'approved', 'rejected', 'expired'));

-- Create match approvals table
CREATE TABLE IF NOT EXISTS public.match_approvals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id),
  approved BOOLEAN,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

-- Enable RLS on match approvals
ALTER TABLE public.match_approvals ENABLE ROW LEVEL SECURITY;

-- Players can view approvals for their matches
CREATE POLICY "Players can view their match approvals"
ON public.match_approvals
FOR SELECT
USING (auth.uid() = player_id);

-- Players can approve/reject their matches
CREATE POLICY "Players can update their match approvals"
ON public.match_approvals
FOR UPDATE
USING (auth.uid() = player_id);

-- System can insert match approvals
CREATE POLICY "System can insert match approvals"
ON public.match_approvals
FOR INSERT
WITH CHECK (true);

-- Add analytics fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_points_for INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_points_against INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS avg_opponent_rating NUMERIC DEFAULT 3.00;

-- Insert default courts (Attleboro area)
INSERT INTO public.courts (name, location, city, state) VALUES
  ('Tilda Stone Court', '123 Park Ave', 'Attleboro', 'MA'),
  ('Veterans Memorial Park', '456 Memorial Dr', 'Attleboro', 'MA'),
  ('Capron Park Courts', '789 Capron Park', 'Attleboro', 'MA'),
  ('North Attleboro Courts', '321 Main St', 'North Attleboro', 'MA'),
  ('Plainville Recreation', '654 School St', 'Plainville', 'MA')
ON CONFLICT (name, city, state) DO NOTHING;

-- Create trigger to auto-update court stats
CREATE OR REPLACE FUNCTION public.update_profile_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- This will be called after match approval to update player analytics
  RETURN NEW;
END;
$function$;