-- Enable the extensions used by hosted scheduled tasks.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- The original Lovable-generated version of this migration scheduled an HTTP
-- request containing a user JWT and a hard-coded project URL. Hosted schedules
-- are installed safely by 20260910120000_external_supabase_bootstrap.sql.
