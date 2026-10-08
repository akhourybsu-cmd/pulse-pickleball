-- Players and hosts subscribe to these authoritative event tables. Enable
-- delivery on the independent PULSE backend without changing read policies.
DO $$
DECLARE
  event_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH event_table IN ARRAY ARRAY['round_robin_events', 'round_robin_schedule', 'round_robin_players'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = event_table
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', event_table);
      END IF;
    END LOOP;
  END IF;
END $$;
