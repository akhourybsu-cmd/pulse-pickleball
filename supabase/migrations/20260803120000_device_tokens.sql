-- Native push: FCM/APNs device tokens for the mobile (Capacitor) app.
--
-- Web push uses `push_subscriptions` (endpoint + p256dh + auth, the Web Push
-- standard). The native app can't use that — it registers with FCM (Android)
-- / APNs (iOS) and gets an opaque device token instead. This table stores
-- those so the backend can fan a notification out to a user's native devices
-- alongside their web subscriptions.

CREATE TABLE IF NOT EXISTS public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- A device token is unique to a device+app install; re-registration upserts
  -- on it so a token always maps to the current owner.
  UNIQUE(token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users manage only their own device tokens. The backend sender runs with the
-- service role, which bypasses RLS.
CREATE POLICY "Users can view their own device tokens"
ON public.device_tokens FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own device tokens"
ON public.device_tokens FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device tokens"
ON public.device_tokens FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device tokens"
ON public.device_tokens FOR DELETE
USING (auth.uid() = user_id);
