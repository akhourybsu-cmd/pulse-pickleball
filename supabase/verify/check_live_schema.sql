-- =====================================================================
-- Pulse Pickleball — Live Schema Verification
--
-- READ-ONLY. Safe to run in the Supabase SQL editor against the live
-- database. Returns one row per check with status = 'OK' or 'MISSING'.
--
-- Use this to confirm the live database has every function, column,
-- enum value, table, bucket, and extension the recent frontend
-- (Community Phases 1–4, RR overhaul, Phase 1 reliability fixes)
-- depends on.
--
-- Anything that returns 'MISSING' here must be applied to the live DB
-- before the corresponding feature works.
-- =====================================================================

WITH checks AS (
  -- ---------------- RPC functions ----------------
  SELECT 'RPC: submit_rr_match_score'                AS item, EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'submit_rr_match_score')        AS present
  UNION ALL SELECT 'RPC: void_round_robin_event',          EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'void_round_robin_event')
  UNION ALL SELECT 'RPC: delete_round_robin_event',        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'delete_round_robin_event')
  UNION ALL SELECT 'RPC: preview_round_robin_by_code',     EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'preview_round_robin_by_code')
  UNION ALL SELECT 'RPC: join_round_robin_by_code',        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'join_round_robin_by_code')
  UNION ALL SELECT 'RPC: generate_rr_invite_code',         EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'generate_rr_invite_code')
  UNION ALL SELECT 'RPC: cast_group_poll_vote',            EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'cast_group_poll_vote')
  UNION ALL SELECT 'RPC: set_group_message_pin',           EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'set_group_message_pin')
  UNION ALL SELECT 'RPC: set_group_notification_pref',     EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'set_group_notification_pref')
  UNION ALL SELECT 'RPC: is_group_channel_enabled',        EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'is_group_channel_enabled')
  UNION ALL SELECT 'RPC: group_invite_summary',            EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'group_invite_summary')
  UNION ALL SELECT 'RPC: dispatch_push_for_notification',  EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'dispatch_push_for_notification')
  UNION ALL SELECT 'RPC: protect_group_message_pin_columns', EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'protect_group_message_pin_columns')

  -- ---------------- Enum values ----------------
  UNION ALL SELECT 'enum: round_robin_status has ''voided''',
                   EXISTS(
                     SELECT 1 FROM pg_enum e
                       JOIN pg_type t ON t.oid = e.enumtypid
                      WHERE t.typname = 'round_robin_status'
                        AND e.enumlabel = 'voided'
                   )

  -- ---------------- Columns ----------------
  UNION ALL SELECT 'col: round_robin_events.invite_code',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'round_robin_events' AND column_name = 'invite_code')
  UNION ALL SELECT 'col: round_robin_events.registration_mode',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'round_robin_events' AND column_name = 'registration_mode')
  UNION ALL SELECT 'col: round_robin_events.voided',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'round_robin_events' AND column_name = 'voided')
  UNION ALL SELECT 'col: matches.count_for_rating',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'count_for_rating')
  UNION ALL SELECT 'col: matches.voided',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'voided')
  UNION ALL SELECT 'col: group_posts.poll_options',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'group_posts' AND column_name = 'poll_options')
  UNION ALL SELECT 'col: group_messages.is_pinned',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'group_messages' AND column_name = 'is_pinned')
  UNION ALL SELECT 'col: group_messages.edited_at',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'group_messages' AND column_name = 'edited_at')
  UNION ALL SELECT 'col: group_messages.image_url',
                   EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'group_messages' AND column_name = 'image_url')

  -- ---------------- Tables ----------------
  UNION ALL SELECT 'table: group_poll_votes',
                   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'group_poll_votes')
  UNION ALL SELECT 'table: group_notification_prefs',
                   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'group_notification_prefs')
  UNION ALL SELECT 'table: group_invite_uses',
                   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'group_invite_uses')
  UNION ALL SELECT 'table: push_subscriptions',
                   EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'push_subscriptions')

  -- ---------------- RLS policies (Phase 1.2 fix) ----------------
  UNION ALL SELECT 'policy: group_messages UPDATE',
                   EXISTS(
                     SELECT 1 FROM pg_policies
                      WHERE schemaname = 'public'
                        AND tablename  = 'group_messages'
                        AND cmd        = 'UPDATE'
                   )
  UNION ALL SELECT 'trigger: protect_group_message_pin_columns',
                   EXISTS(
                     SELECT 1 FROM pg_trigger
                      WHERE tgname = 'protect_group_message_pin_columns'
                   )

  -- ---------------- Storage buckets ----------------
  UNION ALL SELECT 'bucket: group-message-images',
                   EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'group-message-images')
  UNION ALL SELECT 'bucket: group-post-images',
                   EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'group-post-images')
  UNION ALL SELECT 'bucket: avatars',
                   EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'avatars')

  -- ---------------- Extensions ----------------
  UNION ALL SELECT 'ext: pg_net (for push dispatch)',
                   EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
)
SELECT
  item,
  CASE WHEN present THEN 'OK' ELSE 'MISSING' END AS status
FROM checks
ORDER BY present, item;

-- ---------------------------------------------------------------------
-- Optional: GUC / setting checks for the push dispatch trigger.
-- These only matter once you want device push notifications to fire.
-- ---------------------------------------------------------------------
SELECT
  'guc: app.settings.push_send_url' AS item,
  CASE WHEN current_setting('app.settings.push_send_url', true) IS NULL OR current_setting('app.settings.push_send_url', true) = ''
       THEN 'MISSING' ELSE 'OK' END AS status
UNION ALL
SELECT
  'guc: app.settings.service_role_key',
  CASE WHEN current_setting('app.settings.service_role_key', true) IS NULL OR current_setting('app.settings.service_role_key', true) = ''
       THEN 'MISSING' ELSE 'OK' END;

-- ---------------------------------------------------------------------
-- Optional: cron schedule check (only if pg_cron is installed).
-- ---------------------------------------------------------------------
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname LIKE 'send-group-event-reminders%';
