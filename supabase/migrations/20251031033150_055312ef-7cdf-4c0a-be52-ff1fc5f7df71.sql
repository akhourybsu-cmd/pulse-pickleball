-- Drop the previous policy and create a better one for anonymous kiosk access
DROP POLICY IF EXISTS "Anyone can view profiles for live/completed event participants" ON public.profiles;

-- Create policy that explicitly allows anon role to view basic profile info for event participants
CREATE POLICY "Public can view event participant profiles"
ON public.profiles
FOR SELECT
TO anon, authenticated
USING (
  -- Allow viewing profiles of players in live/completed round robin events
  id IN (
    SELECT DISTINCT rp.player_id 
    FROM round_robin_players rp
    JOIN round_robin_events re ON rp.event_id = re.id
    WHERE re.status IN ('live', 'completed')
  )
);