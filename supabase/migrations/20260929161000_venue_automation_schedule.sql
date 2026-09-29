-- The scheduler runs independently of staff browsers. Venue automation is opt-in.
SELECT cron.schedule('venue-operations-automation','* * * * *','SELECT public.venue_process_automations();');
