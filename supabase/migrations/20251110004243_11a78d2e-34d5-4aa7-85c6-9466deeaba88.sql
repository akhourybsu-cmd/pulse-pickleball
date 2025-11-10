-- Create biometric analytics table
CREATE TABLE public.biometric_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'enrollment_started', 'enrollment_success', 'enrollment_failed', 'login_attempt', 'login_success', 'login_failed'
  error_type TEXT, -- 'browser_unsupported', 'no_hardware', 'user_cancelled', 'verification_failed', 'network_error', 'rate_limited', null for success
  device_info JSONB DEFAULT '{}'::jsonb, -- browser, platform, device_name
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.biometric_analytics ENABLE ROW LEVEL SECURITY;

-- Admin can view all analytics
CREATE POLICY "Admins can view all biometric analytics"
  ON public.biometric_analytics
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System can insert analytics
CREATE POLICY "System can insert biometric analytics"
  ON public.biometric_analytics
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_biometric_analytics_event_type ON public.biometric_analytics(event_type);
CREATE INDEX idx_biometric_analytics_created_at ON public.biometric_analytics(created_at DESC);
CREATE INDEX idx_biometric_analytics_error_type ON public.biometric_analytics(error_type) WHERE error_type IS NOT NULL;