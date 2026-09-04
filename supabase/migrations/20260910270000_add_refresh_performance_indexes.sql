-- PULSE refresh/navigation performance indexes
--
-- These cover the composite predicates used by the player shell, Home,
-- Social, communities, and league preview queries. They are additive and
-- idempotent: safe to paste into the Supabase SQL editor more than once.

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_read_created
  ON public.user_notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_members_user_status_group
  ON public.group_members (user_id, status, group_id);

CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON public.group_messages (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_user_status
  ON public.friendships (user_id, status);

CREATE INDEX IF NOT EXISTS idx_friendships_friend_status
  ON public.friendships (friend_id, status);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_conversation
  ON public.conversation_participants (user_id, conversation_id);

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation_created
  ON public.direct_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_registrations_user_status
  ON public.event_registrations (user_id, status);

CREATE INDEX IF NOT EXISTS idx_round_robin_players_player_active_event
  ON public.round_robin_players (player_id, active, event_id);

CREATE INDEX IF NOT EXISTS idx_round_robin_events_organizer_status_date
  ON public.round_robin_events (organizer_id, status, date);

CREATE INDEX IF NOT EXISTS idx_league_members_user_status_created
  ON public.league_members (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leagues_created_by
  ON public.leagues (created_by);

CREATE INDEX IF NOT EXISTS idx_league_team_members_team_user_status
  ON public.league_team_members (team_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_league_matches_upcoming
  ON public.league_matches (scheduled_time)
  WHERE status IN ('scheduled', 'in_progress')
    AND scheduled_time IS NOT NULL;

-- Refresh planner statistics after adding the access paths. ANALYZE does not
-- alter application data and is safe while the app is online.
ANALYZE public.user_notifications;
ANALYZE public.group_members;
ANALYZE public.group_messages;
ANALYZE public.friendships;
ANALYZE public.conversation_participants;
ANALYZE public.direct_messages;
ANALYZE public.event_registrations;
ANALYZE public.round_robin_players;
ANALYZE public.round_robin_events;
ANALYZE public.league_members;
ANALYZE public.leagues;
ANALYZE public.league_team_members;
ANALYZE public.league_matches;
