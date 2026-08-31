CREATE POLICY "Kiosk can view guests in live or completed events"
ON public.guest_players
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.round_robin_schedule s
    JOIN public.round_robin_events e ON e.id = s.event_id
    WHERE e.status IN ('live', 'completed')
      AND guest_players.id IN (
        s.a1_guest_id, s.a2_guest_id, s.b1_guest_id, s.b2_guest_id
      )
  )
);
GRANT SELECT ON public.guest_players TO anon;