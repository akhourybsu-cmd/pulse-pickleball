-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cleanup function to run every day at 3 AM
SELECT cron.schedule(
  'cleanup-old-court-messages',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT
    net.http_post(
        url:='https://ryxklkayezjnwwunuphn.supabase.co/functions/v1/cleanup-old-messages',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5eGtsa2F5ZXpqbnd3dW51cGhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzMTk4NzgsImV4cCI6MjA3NDg5NTg3OH0.2srb4SNceNhhjWGvzqHUQQIFaIJy--wWcgNe63ZM_4o"}'::jsonb
    ) as request_id;
  $$
);