-- Upgrade the original flat comments table to support authors and replies.
-- Earlier Lovable migrations created this table with a `user_id` column, so a
-- fresh external Supabase build must evolve that table instead of recreating it.
CREATE TABLE IF NOT EXISTS public.court_post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.court_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.court_post_comments
  ADD COLUMN IF NOT EXISTS author_user_id UUID,
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_post_comments'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'UPDATE public.court_post_comments
      SET author_user_id = user_id
      WHERE author_user_id IS NULL';
  END IF;
END;
$$;

ALTER TABLE public.court_post_comments
  ALTER COLUMN author_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'court_post_comments_author_user_id_fkey'
      AND conrelid = 'public.court_post_comments'::regclass
  ) THEN
    ALTER TABLE public.court_post_comments
      ADD CONSTRAINT court_post_comments_author_user_id_fkey
      FOREIGN KEY (author_user_id)
      REFERENCES public.profiles(id)
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'court_post_comments_parent_comment_id_fkey'
      AND conrelid = 'public.court_post_comments'::regclass
  ) THEN
    ALTER TABLE public.court_post_comments
      ADD CONSTRAINT court_post_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id)
      REFERENCES public.court_post_comments(id)
      ON DELETE CASCADE;
  END IF;
END;
$$;

DROP POLICY IF EXISTS "Anyone can view comments" ON public.court_post_comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.court_post_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON public.court_post_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON public.court_post_comments;

ALTER TABLE public.court_post_comments
  DROP CONSTRAINT IF EXISTS court_post_comments_user_id_fkey,
  DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.court_post_comments ENABLE ROW LEVEL SECURITY;

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
  USING (auth.uid() = author_user_id)
  WITH CHECK (auth.uid() = author_user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.court_post_comments
  FOR DELETE
  USING (auth.uid() = author_user_id);

CREATE TABLE IF NOT EXISTS public.court_post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.court_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id, emoji)
);

ALTER TABLE public.court_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view reactions" ON public.court_post_reactions;
DROP POLICY IF EXISTS "Authenticated users can add reactions" ON public.court_post_reactions;
DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.court_post_reactions;

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

CREATE INDEX IF NOT EXISTS idx_court_post_comments_post_id
  ON public.court_post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_court_post_comments_parent_id
  ON public.court_post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_court_post_reactions_post_id
  ON public.court_post_reactions(post_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'court_post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.court_post_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'court_post_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.court_post_reactions;
  END IF;
END;
$$;
