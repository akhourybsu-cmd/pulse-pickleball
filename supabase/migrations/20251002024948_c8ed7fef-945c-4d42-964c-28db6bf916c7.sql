-- The original Lovable project contained this table before the checked-in
-- migration history began referencing it. Recreate the missing foundation so
-- a fresh Supabase project can be built from source.
CREATE TABLE IF NOT EXISTS public.court_post_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.court_post_participants
ADD COLUMN IF NOT EXISTS comment TEXT;

ALTER TABLE public.court_post_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view court post participants"
  ON public.court_post_participants
  FOR SELECT
  USING (true);

CREATE POLICY "Users can join court posts as themselves"
  ON public.court_post_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own court post participation"
  ON public.court_post_participants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave court posts"
  ON public.court_post_participants
  FOR DELETE
  USING (auth.uid() = user_id);
