-- Create tournament_customization table
CREATE TABLE IF NOT EXISTS public.tournament_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.tournaments_events(id) ON DELETE CASCADE,
  is_published BOOLEAN NOT NULL DEFAULT false,
  hero_image_url TEXT,
  hero_overlay_color TEXT CHECK (hero_overlay_color IN ('lime', 'teal', 'dark-teal-overlay', 'none')),
  tagline TEXT,
  about_markdown TEXT,
  about_image_url TEXT,
  map_embed TEXT,
  venue_photo_url TEXT,
  sponsors JSONB,
  policies_text TEXT,
  organizer_contact_name TEXT,
  organizer_contact_email TEXT,
  organizer_social_links JSONB,
  theme_accent TEXT CHECK (theme_accent IN ('lime', 'teal', 'dark-teal', 'light-card')) DEFAULT 'lime',
  venue_details JSONB,
  last_updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tournament_customization ENABLE ROW LEVEL SECURITY;

-- Public can view published customizations
CREATE POLICY "Public can view published customizations"
  ON public.tournament_customization
  FOR SELECT
  USING (is_published = true);

-- Admins can view all customizations
CREATE POLICY "Admins can view all customizations"
  ON public.tournament_customization
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Event creators can view their customizations
CREATE POLICY "Event creators can view their customizations"
  ON public.tournament_customization
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- Admins can manage all customizations
CREATE POLICY "Admins can manage customizations"
  ON public.tournament_customization
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Event creators can manage their customizations
CREATE POLICY "Event creators can manage their customizations"
  ON public.tournament_customization
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.tournaments_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tournaments_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- Create storage bucket for tournament assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('tournament-assets', 'tournament-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for tournament assets
CREATE POLICY "Public can view tournament assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tournament-assets');

CREATE POLICY "Authenticated users can upload tournament assets"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'tournament-assets' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update their tournament assets"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'tournament-assets' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete their tournament assets"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'tournament-assets' AND
    auth.uid() IS NOT NULL
  );

-- Trigger to update updated_at
CREATE TRIGGER update_tournament_customization_updated_at
  BEFORE UPDATE ON public.tournament_customization
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();