-- Allow public read access to basic profile info for players in live/completed round robin events
-- This is needed for kiosk mode to display player names
CREATE POLICY "Anyone can view profiles for live/completed event participants"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM round_robin_players rp
    JOIN round_robin_events re ON rp.event_id = re.id
    WHERE rp.player_id = profiles.id
    AND re.status IN ('live', 'completed')
  )
);