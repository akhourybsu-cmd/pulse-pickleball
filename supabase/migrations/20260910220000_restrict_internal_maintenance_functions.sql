-- Internal maintenance helpers must not be callable as client-facing RPCs.
-- Their only database callers are trusted SECURITY DEFINER functions/triggers,
-- and no frontend or Edge Function invokes them directly with a user session.

REVOKE EXECUTE ON FUNCTION public.apply_match_rating_incremental(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_players_to_courts(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_award_badges(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_completed_match(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rpc_rate_limit_log()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_all_match_history()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_notification(
  uuid, text, text, text, text, text, uuid, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_stale_pending_matches()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.freeze_week_ratings(date)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_all_player_stats()
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_player_stats(uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_match_rating_incremental(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_players_to_courts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_and_award_badges(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_completed_match(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_mfa_codes() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_rpc_rate_limit_log() TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_all_match_history() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_notification(
  uuid, text, text, text, text, text, text, jsonb, uuid, timestamptz
) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(
  uuid, text, text, text, text, text, uuid, jsonb
) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_stale_pending_matches() TO service_role;
GRANT EXECUTE ON FUNCTION public.freeze_week_ratings(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_all_player_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_player_stats(uuid) TO service_role;
