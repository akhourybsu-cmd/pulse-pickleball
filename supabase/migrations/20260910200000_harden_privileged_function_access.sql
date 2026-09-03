-- Harden the first reviewed batch of mutable-search-path functions.
--
-- The four pgmq wrappers are SECURITY DEFINER and are called only by Edge
-- Functions using the service role. Earlier migrations revoked PUBLIC, but
-- explicit anon/authenticated grants remained after the database transfer.
-- Remove those grants and keep a deterministic search path for every function
-- in this reviewed batch without changing any function body or behavior.

ALTER FUNCTION public.enqueue_email(text, jsonb)
  SET search_path = pg_catalog, pgmq, public, pg_temp;

ALTER FUNCTION public.read_email_batch(text, integer, integer)
  SET search_path = pg_catalog, pgmq, public, pg_temp;

ALTER FUNCTION public.delete_email(text, bigint)
  SET search_path = pg_catalog, pgmq, public, pg_temp;

ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb)
  SET search_path = pg_catalog, pgmq, public, pg_temp;

REVOKE ALL PRIVILEGES ON FUNCTION public.enqueue_email(text, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.read_email_batch(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.delete_email(text, bigint)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

ALTER FUNCTION public.update_conversation_timestamp()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.assert_forfeit_winner_is_participant()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.enforce_name_lock()
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.normalize_invite_code(text)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.notif_preview(text)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.skill_touch_updated_at()
  SET search_path = pg_catalog, public, pg_temp;
