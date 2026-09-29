-- Recover missed Stripe callbacks and release expired desk/booking inventory.
-- The established scheduler secret stays inside the database and Edge runtime.
SELECT cron.schedule('venue-payment-recovery','*/5 * * * *',$job$
 SELECT net.http_post(
  url := (SELECT value FROM private.app_config WHERE key='edge_functions_base_url') || '/payment-reconcile',
  headers := jsonb_build_object('Content-Type','application/json','x-dispatch-secret',(SELECT value FROM private.app_config WHERE key='scheduled_task_secret')),
  body := '{}'::jsonb,timeout_milliseconds := 20000
 );
$job$);
