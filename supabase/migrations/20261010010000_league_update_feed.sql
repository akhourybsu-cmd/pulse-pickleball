-- League-wide organizer updates. Seasons share one feed; group posts are untouched.
BEGIN;

CREATE TABLE IF NOT EXISTS public.league_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  content text NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 4000 AND content ~ '[^[:space:]]'),
  pinned boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX IF NOT EXISTS league_posts_feed_order ON public.league_posts
  (league_id, pinned DESC, created_at DESC, id DESC);
ALTER TABLE public.league_posts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_league_feed(p_league_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.leagues l WHERE l.id = p_league_id AND (
      public.is_league_admin(l.id, auth.uid())
      OR (l.visibility <> 'admin_only' AND (
        EXISTS (SELECT 1 FROM public.league_members m
          WHERE m.league_id = l.id AND m.user_id = auth.uid() AND m.status = 'active')
        OR EXISTS (SELECT 1 FROM public.league_substitutes s
          WHERE s.league_id = l.id AND s.user_id = auth.uid() AND s.status = 'active')
      ))
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_league_feed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_league_feed(uuid) TO authenticated;
DROP POLICY IF EXISTS "League participants read updates" ON public.league_posts;
CREATE POLICY "League participants read updates" ON public.league_posts
  FOR SELECT TO authenticated USING (public.can_read_league_feed(league_id));
-- Mutations go through guarded RPCs, so identity, timestamps and versions
-- cannot be forged even by a manager's direct REST request.
REVOKE ALL ON public.league_posts FROM anon, authenticated;
GRANT SELECT ON public.league_posts TO authenticated;
GRANT ALL ON public.league_posts TO service_role;

CREATE OR REPLACE FUNCTION public.create_league_post(
  p_league_id uuid, p_content text, p_post_id uuid
) RETURNS public.league_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post public.league_posts; v_content text := btrim(p_content);
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_league_admin(p_league_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the league owner or an active manager can post updates' USING ERRCODE = '42501';
  END IF;
  IF p_post_id IS NULL OR v_content IS NULL OR char_length(v_content) NOT BETWEEN 1 AND 4000 OR v_content !~ '[^[:space:]]' THEN
    RAISE EXCEPTION 'Write an update between 1 and 4,000 characters' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.league_posts(id,league_id,author_id,content)
    VALUES(p_post_id,p_league_id,auth.uid(),v_content) ON CONFLICT (id) DO NOTHING;
  SELECT * INTO v_post FROM public.league_posts WHERE id = p_post_id;
  -- A lost response can be retried with the same id without creating a second post.
  IF v_post.league_id IS DISTINCT FROM p_league_id OR v_post.author_id IS DISTINCT FROM auth.uid()
     OR v_post.content IS DISTINCT FROM v_content THEN
    RAISE EXCEPTION 'This update was already saved with different content. Refresh the feed before posting again.' USING ERRCODE = '40001';
  END IF;
  RETURN v_post;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_league_post(
  p_post_id uuid, p_expected_version integer, p_content text, p_pinned boolean
) RETURNS public.league_posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post public.league_posts; v_content text := btrim(p_content);
BEGIN
  SELECT * INTO v_post FROM public.league_posts WHERE id = p_post_id FOR UPDATE;
  IF auth.uid() IS NULL OR v_post.id IS NULL OR NOT public.is_league_admin(v_post.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the league owner or an active manager can change updates' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_post.version THEN
    RAISE EXCEPTION 'This update changed. Refresh the feed and review the latest version before saving.' USING ERRCODE = '40001';
  END IF;
  IF v_content IS NULL OR char_length(v_content) NOT BETWEEN 1 AND 4000 OR v_content !~ '[^[:space:]]' OR p_pinned IS NULL THEN
    RAISE EXCEPTION 'Write an update between 1 and 4,000 characters' USING ERRCODE = '22023';
  END IF;
  UPDATE public.league_posts SET content = v_content, pinned = p_pinned,
    version = version + 1, updated_at = clock_timestamp(),
    edited_at = CASE WHEN content IS DISTINCT FROM v_content THEN clock_timestamp() ELSE edited_at END
    WHERE id = p_post_id RETURNING * INTO v_post;
  RETURN v_post;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_league_post(p_post_id uuid, p_expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_post public.league_posts;
BEGIN
  SELECT * INTO v_post FROM public.league_posts WHERE id = p_post_id FOR UPDATE;
  IF auth.uid() IS NULL OR v_post.id IS NULL OR NOT public.is_league_admin(v_post.league_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the league owner or an active manager can delete updates' USING ERRCODE = '42501';
  END IF;
  IF p_expected_version IS DISTINCT FROM v_post.version THEN
    RAISE EXCEPTION 'This update changed. Refresh the feed and review the latest version before deleting.' USING ERRCODE = '40001';
  END IF;
  DELETE FROM public.league_posts WHERE id = p_post_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_league_post(uuid,text,uuid),
  public.update_league_post(uuid,integer,text,boolean), public.delete_league_post(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_league_post(uuid,text,uuid),
  public.update_league_post(uuid,integer,text,boolean), public.delete_league_post(uuid,integer) TO authenticated;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') AND NOT EXISTS (
    SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'league_posts'
  ) THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.league_posts; END IF;
END $$;
COMMIT;
