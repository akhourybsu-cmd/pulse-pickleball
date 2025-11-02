-- Create court_post_comments table
CREATE TABLE public.court_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.court_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.court_post_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Anyone can view comments"
  ON public.court_post_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create comments"
  ON public.court_post_comments
  FOR INSERT
  WITH CHECK (auth.uid() = author_user_id);

CREATE POLICY "Users can update their own comments"
  ON public.court_post_comments
  FOR UPDATE
  USING (auth.uid() = author_user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.court_post_comments
  FOR DELETE
  USING (auth.uid() = author_user_id);

-- Create court_post_reactions table
CREATE TABLE public.court_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

-- Enable RLS
ALTER TABLE public.court_post_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reactions
CREATE POLICY "Anyone can view reactions"
  ON public.court_post_reactions
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can add reactions"
  ON public.court_post_reactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own reactions"
  ON public.court_post_reactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes for better performance
CREATE INDEX idx_court_post_comments_post_id ON public.court_post_comments(post_id);
CREATE INDEX idx_court_post_comments_parent_id ON public.court_post_comments(parent_comment_id);
CREATE INDEX idx_court_post_reactions_post_id ON public.court_post_reactions(post_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.court_post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.court_post_reactions;