CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
  ON public.user_notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_participants_player_match
  ON public.match_participants (player_id, match_id);

CREATE INDEX IF NOT EXISTS idx_group_posts_group_created
  ON public.group_posts (group_id, created_at DESC);
