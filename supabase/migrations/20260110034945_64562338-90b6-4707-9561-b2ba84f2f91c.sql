-- Create subscription tier enum
CREATE TYPE public.subscription_tier AS ENUM ('free', 'plus', 'pro', 'enterprise');

-- Create venue subscriptions table
CREATE TABLE public.venue_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  tier subscription_tier NOT NULL DEFAULT 'free',
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id)
);

-- Create feature entitlements table (defines what each tier gets)
CREATE TABLE public.feature_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier subscription_tier NOT NULL,
  feature_key TEXT NOT NULL,
  limit_value INTEGER, -- null means unlimited
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tier, feature_key)
);

-- Insert default entitlements
INSERT INTO public.feature_entitlements (tier, feature_key, limit_value, enabled) VALUES
  -- Free tier
  ('free', 'max_events_per_month', 2, true),
  ('free', 'max_courts', 2, true),
  ('free', 'max_coaches', 1, true),
  ('free', 'analytics_basic', NULL, true),
  ('free', 'analytics_advanced', NULL, false),
  ('free', 'custom_branding', NULL, false),
  ('free', 'priority_support', NULL, false),
  
  -- Plus tier
  ('plus', 'max_events_per_month', 10, true),
  ('plus', 'max_courts', 8, true),
  ('plus', 'max_coaches', 5, true),
  ('plus', 'analytics_basic', NULL, true),
  ('plus', 'analytics_advanced', NULL, true),
  ('plus', 'custom_branding', NULL, false),
  ('plus', 'priority_support', NULL, false),
  
  -- Pro tier
  ('pro', 'max_events_per_month', NULL, true),
  ('pro', 'max_courts', NULL, true),
  ('pro', 'max_coaches', NULL, true),
  ('pro', 'analytics_basic', NULL, true),
  ('pro', 'analytics_advanced', NULL, true),
  ('pro', 'custom_branding', NULL, true),
  ('pro', 'priority_support', NULL, true),
  
  -- Enterprise tier (same as pro but custom limits negotiated)
  ('enterprise', 'max_events_per_month', NULL, true),
  ('enterprise', 'max_courts', NULL, true),
  ('enterprise', 'max_coaches', NULL, true),
  ('enterprise', 'analytics_basic', NULL, true),
  ('enterprise', 'analytics_advanced', NULL, true),
  ('enterprise', 'custom_branding', NULL, true),
  ('enterprise', 'priority_support', NULL, true);

-- Enable RLS
ALTER TABLE public.venue_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS: Venue owners/staff can view their subscription
CREATE POLICY "Venue staff can view subscription"
ON public.venue_subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.venue_staff vs
    WHERE vs.venue_id = venue_subscriptions.venue_id
    AND vs.user_id = auth.uid()
  )
);

-- RLS: Feature entitlements are public read
CREATE POLICY "Anyone can view entitlements"
ON public.feature_entitlements
FOR SELECT
USING (true);

-- Create trigger to update updated_at
CREATE TRIGGER update_venue_subscriptions_updated_at
BEFORE UPDATE ON public.venue_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Initialize free subscription for existing venues
INSERT INTO public.venue_subscriptions (venue_id, tier, status)
SELECT id, 'free', 'active'
FROM public.venues
ON CONFLICT (venue_id) DO NOTHING;