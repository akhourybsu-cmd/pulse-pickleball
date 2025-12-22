-- Create venue role enum
CREATE TYPE public.venue_role AS ENUM ('owner', 'manager', 'staff');

-- Create venues table
CREATE TABLE public.venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  logo_url TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create venue_staff table for role-based access
CREATE TABLE public.venue_staff (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role venue_role NOT NULL DEFAULT 'staff',
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(venue_id, user_id)
);

-- Create indexes for performance
CREATE INDEX idx_venues_owner ON public.venues(owner_id);
CREATE INDEX idx_venues_slug ON public.venues(slug);
CREATE INDEX idx_venue_staff_user ON public.venue_staff(user_id);
CREATE INDEX idx_venue_staff_venue ON public.venue_staff(venue_id);

-- Enable RLS
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_staff ENABLE ROW LEVEL SECURITY;

-- Security definer function to check venue access
CREATE OR REPLACE FUNCTION public.has_venue_access(_user_id uuid, _venue_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venue_staff
    WHERE user_id = _user_id 
      AND venue_id = _venue_id 
      AND is_active = true
  ) OR EXISTS (
    SELECT 1
    FROM public.venues
    WHERE id = _venue_id
      AND owner_id = _user_id
  )
$$;

-- Function to check venue role
CREATE OR REPLACE FUNCTION public.has_venue_role(_user_id uuid, _venue_id uuid, _role venue_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.venue_staff
    WHERE user_id = _user_id 
      AND venue_id = _venue_id 
      AND role = _role
      AND is_active = true
  ) OR (
    _role = 'owner' AND EXISTS (
      SELECT 1
      FROM public.venues
      WHERE id = _venue_id AND owner_id = _user_id
    )
  )
$$;

-- Function to get user's venues
CREATE OR REPLACE FUNCTION public.get_user_venues(_user_id uuid)
RETURNS TABLE(venue_id uuid, venue_name text, role venue_role)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.name, COALESCE(vs.role, 'owner'::venue_role)
  FROM public.venues v
  LEFT JOIN public.venue_staff vs ON vs.venue_id = v.id AND vs.user_id = _user_id AND vs.is_active = true
  WHERE v.owner_id = _user_id OR vs.user_id IS NOT NULL
$$;

-- RLS Policies for venues
CREATE POLICY "Venues are viewable by everyone"
ON public.venues
FOR SELECT
USING (is_active = true);

CREATE POLICY "Owners can update their venues"
ON public.venues
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Authenticated users can create venues"
ON public.venues
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their venues"
ON public.venues
FOR DELETE
USING (auth.uid() = owner_id);

-- RLS Policies for venue_staff
CREATE POLICY "Staff can view their own membership"
ON public.venue_staff
FOR SELECT
USING (auth.uid() = user_id OR has_venue_role(auth.uid(), venue_id, 'owner') OR has_venue_role(auth.uid(), venue_id, 'manager'));

CREATE POLICY "Owners and managers can add staff"
ON public.venue_staff
FOR INSERT
WITH CHECK (has_venue_role(auth.uid(), venue_id, 'owner') OR has_venue_role(auth.uid(), venue_id, 'manager'));

CREATE POLICY "Owners and managers can update staff"
ON public.venue_staff
FOR UPDATE
USING (has_venue_role(auth.uid(), venue_id, 'owner') OR has_venue_role(auth.uid(), venue_id, 'manager'));

CREATE POLICY "Owners can delete staff"
ON public.venue_staff
FOR DELETE
USING (has_venue_role(auth.uid(), venue_id, 'owner'));

-- Trigger for updated_at
CREATE TRIGGER update_venues_updated_at
BEFORE UPDATE ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_venue_staff_updated_at
BEFORE UPDATE ON public.venue_staff
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();