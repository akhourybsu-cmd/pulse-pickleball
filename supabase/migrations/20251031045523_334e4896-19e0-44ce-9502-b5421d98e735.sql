-- Create table for user court preferences
CREATE TABLE IF NOT EXISTS public.user_court_prefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  hidden_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, court_id)
);

-- Enable RLS
ALTER TABLE public.user_court_prefs ENABLE ROW LEVEL SECURITY;

-- Policies for user_court_prefs
CREATE POLICY "Users can manage their own court preferences"
  ON public.user_court_prefs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX idx_user_court_prefs_user_id ON public.user_court_prefs(user_id);
CREATE INDEX idx_user_court_prefs_court_id ON public.user_court_prefs(court_id);

-- Trigger to update updated_at
CREATE TRIGGER update_user_court_prefs_updated_at
  BEFORE UPDATE ON public.user_court_prefs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();