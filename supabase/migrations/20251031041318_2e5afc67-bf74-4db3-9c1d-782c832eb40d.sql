-- Drop the existing limited profile view policy that's causing issues
DROP POLICY IF EXISTS "Public can view event participant profiles" ON public.profiles;

-- Create a better policy that allows viewing profiles of players in live/completed event schedules
CREATE POLICY "Public can view event schedule participant profiles"
ON public.profiles
FOR SELECT
TO public
USING (
  id IN (
    SELECT DISTINCT player_id
    FROM (
      -- Get all player IDs from current and next rounds of live/completed events
      SELECT a1_player_id AS player_id FROM round_robin_schedule rs
      JOIN round_robin_events re ON rs.event_id = re.id
      WHERE re.status IN ('live', 'completed')
      UNION
      SELECT a2_player_id FROM round_robin_schedule rs
      JOIN round_robin_events re ON rs.event_id = re.id
      WHERE re.status IN ('live', 'completed')
      UNION
      SELECT b1_player_id FROM round_robin_schedule rs
      JOIN round_robin_events re ON rs.event_id = re.id
      WHERE re.status IN ('live', 'completed')
      UNION
      SELECT b2_player_id FROM round_robin_schedule rs
      JOIN round_robin_events re ON rs.event_id = re.id
      WHERE re.status IN ('live', 'completed')
    ) AS all_player_ids
    WHERE player_id IS NOT NULL
  )
);