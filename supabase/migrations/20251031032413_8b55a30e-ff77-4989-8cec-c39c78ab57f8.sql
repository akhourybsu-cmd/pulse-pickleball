-- Allow public read access to round robin events (for kiosk mode)
-- Kiosk mode needs to display event data without authentication
-- Write operations are still protected by organizer/admin policies

CREATE POLICY "Anyone can view live/completed events for kiosk"
ON public.round_robin_events
FOR SELECT
USING (status IN ('live', 'completed'));

-- Allow public read access to round robin schedule (for kiosk mode)
CREATE POLICY "Anyone can view schedule for live/completed events"
ON public.round_robin_schedule
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM round_robin_events
    WHERE id = round_robin_schedule.event_id
    AND status IN ('live', 'completed')
  )
);