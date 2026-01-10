
-- =====================================================
-- PHASE 1: VENUE CUSTOMIZATION SYSTEM - COMPLETE SCHEMA
-- =====================================================

-- 1) CREATE ENUMS
-- =====================================================

-- Venue visibility enum
DO $$ BEGIN
  CREATE TYPE venue_visibility AS ENUM ('public', 'unlisted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Venue status enum
DO $$ BEGIN
  CREATE TYPE venue_status AS ENUM ('draft', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Venue type enum
DO $$ BEGIN
  CREATE TYPE venue_type AS ENUM ('recreation_center', 'private_club', 'public_courts', 'tournament_organizer', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Venue logo shape enum
DO $$ BEGIN
  CREATE TYPE venue_logo_shape AS ENUM ('circle', 'square');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cover focal point enum
DO $$ BEGIN
  CREATE TYPE cover_focal_point AS ENUM ('top', 'center');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Membership status enum
DO $$ BEGIN
  CREATE TYPE membership_status AS ENUM ('active', 'invited', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Court location type enum
DO $$ BEGIN
  CREATE TYPE court_location_type AS ENUM ('indoor', 'outdoor', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Court surface type enum
DO $$ BEGIN
  CREATE TYPE court_surface_type AS ENUM ('hard', 'wood', 'sport_court', 'clay', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) EXTEND VENUES TABLE
-- =====================================================

-- Add venue_type column
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS venue_type venue_type DEFAULT 'other';

-- Add address columns
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS address_line1 text,
ADD COLUMN IF NOT EXISTS address_line2 text,
ADD COLUMN IF NOT EXISTS country text DEFAULT 'US';

-- Add social media columns
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS website_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS facebook_url text,
ADD COLUMN IF NOT EXISTS x_url text,
ADD COLUMN IF NOT EXISTS tiktok_url text;

-- Add branding columns
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS logo_shape venue_logo_shape DEFAULT 'circle',
ADD COLUMN IF NOT EXISTS cover_image_url text,
ADD COLUMN IF NOT EXISTS cover_focal_point cover_focal_point DEFAULT 'center';

-- Add welcome/CTA columns
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS welcome_headline text,
ADD COLUMN IF NOT EXISTS welcome_message text,
ADD COLUMN IF NOT EXISTS cta_primary_label text DEFAULT 'Create a Tournament',
ADD COLUMN IF NOT EXISTS cta_secondary_label text DEFAULT 'Create a Round Robin';

-- Add visibility/status columns
ALTER TABLE public.venues 
ADD COLUMN IF NOT EXISTS visibility venue_visibility DEFAULT 'public',
ADD COLUMN IF NOT EXISTS status venue_status DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS is_searchable boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_follow boolean DEFAULT true;

-- 3) CREATE VENUE_FACILITY_DETAILS TABLE (1:1 with venues)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.venue_facility_details (
  venue_id uuid PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
  court_count int DEFAULT 0,
  location_type court_location_type DEFAULT 'mixed',
  surface_type court_surface_type DEFAULT 'other',
  has_lighting boolean DEFAULT false,
  climate_controlled boolean DEFAULT false,
  amenity_restrooms boolean DEFAULT false,
  amenity_water boolean DEFAULT false,
  amenity_parking boolean DEFAULT false,
  amenity_seating boolean DEFAULT false,
  amenity_pro_shop boolean DEFAULT false,
  amenity_food_nearby boolean DEFAULT false,
  offers_open_play boolean DEFAULT false,
  open_play_notes text,
  beginner_friendly boolean DEFAULT false,
  programs_notes text,
  updated_at timestamptz DEFAULT now()
);

-- 4) CREATE VENUE_MEDIA TABLE (Photo Gallery)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.venue_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id uuid NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  media_url text NOT NULL,
  media_type text DEFAULT 'image',
  caption text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient sorting
CREATE INDEX IF NOT EXISTS idx_venue_media_venue_sort ON public.venue_media(venue_id, sort_order);

-- 5) CREATE VENUE_SETTINGS TABLE (1:1 with venues)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.venue_settings (
  venue_id uuid PRIMARY KEY REFERENCES public.venues(id) ON DELETE CASCADE,
  featured_event_id uuid,
  event_sort_mode text DEFAULT 'upcoming_first',
  allow_player_posts boolean DEFAULT true,
  show_gallery boolean DEFAULT true,
  show_amenities boolean DEFAULT true,
  show_facility_details boolean DEFAULT true,
  updated_at timestamptz DEFAULT now()
);

-- 6) UPDATE VENUE_STAFF TABLE WITH STATUS
-- =====================================================

ALTER TABLE public.venue_staff 
ADD COLUMN IF NOT EXISTS status membership_status DEFAULT 'active';

-- 7) ENABLE RLS ON NEW TABLES
-- =====================================================

ALTER TABLE public.venue_facility_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;

-- 8) RLS POLICIES FOR VENUE_FACILITY_DETAILS
-- =====================================================

-- Public can view facility details for published venues
CREATE POLICY "Public can view facility details for published venues"
ON public.venue_facility_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venues v 
    WHERE v.id = venue_facility_details.venue_id 
    AND v.status = 'published'
  )
);

-- Venue staff can view their venue's facility details
CREATE POLICY "Venue staff can view facility details"
ON public.venue_facility_details
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_facility_details.venue_id 
    AND vs.user_id = auth.uid()
  )
);

-- Venue owners/managers can insert facility details
CREATE POLICY "Venue owners and managers can insert facility details"
ON public.venue_facility_details
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_facility_details.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can update facility details
CREATE POLICY "Venue owners and managers can update facility details"
ON public.venue_facility_details
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_facility_details.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can delete facility details
CREATE POLICY "Venue owners and managers can delete facility details"
ON public.venue_facility_details
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_facility_details.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- 9) RLS POLICIES FOR VENUE_MEDIA
-- =====================================================

-- Public can view media for published venues
CREATE POLICY "Public can view media for published venues"
ON public.venue_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venues v 
    WHERE v.id = venue_media.venue_id 
    AND v.status = 'published'
  )
);

-- Venue staff can view their venue's media
CREATE POLICY "Venue staff can view media"
ON public.venue_media
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_media.venue_id 
    AND vs.user_id = auth.uid()
  )
);

-- Venue owners/managers can insert media
CREATE POLICY "Venue owners and managers can insert media"
ON public.venue_media
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_media.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can update media
CREATE POLICY "Venue owners and managers can update media"
ON public.venue_media
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_media.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can delete media
CREATE POLICY "Venue owners and managers can delete media"
ON public.venue_media
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_media.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- 10) RLS POLICIES FOR VENUE_SETTINGS
-- =====================================================

-- Public can view settings for published venues
CREATE POLICY "Public can view settings for published venues"
ON public.venue_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venues v 
    WHERE v.id = venue_settings.venue_id 
    AND v.status = 'published'
  )
);

-- Venue staff can view their venue's settings
CREATE POLICY "Venue staff can view settings"
ON public.venue_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_settings.venue_id 
    AND vs.user_id = auth.uid()
  )
);

-- Venue owners/managers can insert settings
CREATE POLICY "Venue owners and managers can insert settings"
ON public.venue_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_settings.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can update settings
CREATE POLICY "Venue owners and managers can update settings"
ON public.venue_settings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_settings.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- Venue owners/managers can delete settings
CREATE POLICY "Venue owners and managers can delete settings"
ON public.venue_settings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs 
    WHERE vs.venue_id = venue_settings.venue_id 
    AND vs.user_id = auth.uid() 
    AND vs.role IN ('owner', 'manager')
  )
);

-- 11) CREATE AUTO-CREATION TRIGGERS
-- =====================================================

-- Function to auto-create venue_facility_details on venue insert
CREATE OR REPLACE FUNCTION public.create_venue_facility_details()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.venue_facility_details (venue_id)
  VALUES (NEW.id)
  ON CONFLICT (venue_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to auto-create venue_settings on venue insert
CREATE OR REPLACE FUNCTION public.create_venue_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.venue_settings (venue_id)
  VALUES (NEW.id)
  ON CONFLICT (venue_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating facility details
DROP TRIGGER IF EXISTS trigger_create_venue_facility_details ON public.venues;
CREATE TRIGGER trigger_create_venue_facility_details
AFTER INSERT ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.create_venue_facility_details();

-- Create trigger for auto-creating venue settings
DROP TRIGGER IF EXISTS trigger_create_venue_settings ON public.venues;
CREATE TRIGGER trigger_create_venue_settings
AFTER INSERT ON public.venues
FOR EACH ROW
EXECUTE FUNCTION public.create_venue_settings();

-- 12) CREATE FACILITY DETAILS AND SETTINGS FOR EXISTING VENUES
-- =====================================================

-- Create facility_details for any existing venues that don't have them
INSERT INTO public.venue_facility_details (venue_id)
SELECT id FROM public.venues
WHERE id NOT IN (SELECT venue_id FROM public.venue_facility_details)
ON CONFLICT (venue_id) DO NOTHING;

-- Create settings for any existing venues that don't have them
INSERT INTO public.venue_settings (venue_id)
SELECT id FROM public.venues
WHERE id NOT IN (SELECT venue_id FROM public.venue_settings)
ON CONFLICT (venue_id) DO NOTHING;

-- 13) UPDATE TIMESTAMP TRIGGERS
-- =====================================================

-- Trigger function for updating updated_at
CREATE OR REPLACE FUNCTION public.update_venue_related_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for venue_facility_details
DROP TRIGGER IF EXISTS update_venue_facility_details_timestamp ON public.venue_facility_details;
CREATE TRIGGER update_venue_facility_details_timestamp
BEFORE UPDATE ON public.venue_facility_details
FOR EACH ROW
EXECUTE FUNCTION public.update_venue_related_timestamp();

-- Trigger for venue_settings
DROP TRIGGER IF EXISTS update_venue_settings_timestamp ON public.venue_settings;
CREATE TRIGGER update_venue_settings_timestamp
BEFORE UPDATE ON public.venue_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_venue_related_timestamp();
