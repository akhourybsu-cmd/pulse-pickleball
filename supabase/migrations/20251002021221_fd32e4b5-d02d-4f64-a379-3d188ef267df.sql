-- Create court_posts table for LFG posts
CREATE TABLE public.court_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  court_id UUID NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create court_post_comments table
CREATE TABLE public.court_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.court_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for court_posts
CREATE POLICY "Anyone can view court posts"
  ON public.court_posts
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create posts"
  ON public.court_posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts"
  ON public.court_posts
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts"
  ON public.court_posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for court_post_comments
CREATE POLICY "Anyone can view comments"
  ON public.court_post_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.court_post_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON public.court_post_comments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.court_post_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at on court_posts
CREATE TRIGGER update_court_posts_updated_at
  BEFORE UPDATE ON public.court_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();