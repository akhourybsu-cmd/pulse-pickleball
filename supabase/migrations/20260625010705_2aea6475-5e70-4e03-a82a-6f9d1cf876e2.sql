DO $$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'send-group-event-reminders-every-15min';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END;
$$;
DELETE FROM public.user_notifications WHERE notification_type IN ('group_event_1h','group_event_24h');
DELETE FROM public.event_reminders_sent WHERE event_type IN ('group_event_1h','group_event_24h');
