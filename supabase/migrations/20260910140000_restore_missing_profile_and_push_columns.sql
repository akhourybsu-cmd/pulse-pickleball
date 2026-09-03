-- Restore columns that exist in the live Lovable database and generated
-- Supabase types but were missing from the portable migration history.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS town text,
  ADD COLUMN IF NOT EXISTS location_public boolean DEFAULT false;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
