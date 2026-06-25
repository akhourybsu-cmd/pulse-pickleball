SELECT cron.unschedule('send-group-event-reminders-every-15min');
DELETE FROM public.user_notifications WHERE notification_type IN ('group_event_1h','group_event_24h');
DELETE FROM public.event_reminders_sent WHERE event_type IN ('group_event_1h','group_event_24h');