-- Only abbreviated names leave the database. Event and RSVP reads retain RLS.
CREATE OR REPLACE FUNCTION public.get_venue_program_roster(p_event_id uuid)
RETURNS TABLE(name text)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to view the player roster' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.group_events e WHERE e.id = p_event_id
      AND e.parent_event_id IS NULL AND e.venue_id IS NOT NULL
      AND e.event_format IN ('open_play','clinic','practice','round_robin','social','other')
  ) THEN
    RAISE EXCEPTION 'Event roster unavailable' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH normalized AS (
    SELECT r.id, r.created_at,
      nullif(trim(regexp_replace(p.first_name, '[[:space:]]+', ' ', 'g')), '') AS first,
      nullif(trim(regexp_replace(p.last_name, '[[:space:]]+', ' ', 'g')), '') AS last,
      nullif(trim(regexp_replace(p.full_name, '[[:space:]]+', ' ', 'g')), '') AS full_label
    FROM public.group_event_rsvps r
    LEFT JOIN public.profiles_public p ON p.id = r.user_id
    WHERE r.event_id = p_event_id AND r.status = 'going'
  ), parts AS (
    SELECT id, created_at,
      split_part(coalesce(first, full_label), ' ', 1) AS first,
      coalesce(last, CASE WHEN full_label LIKE '% %' THEN regexp_replace(full_label, '^.* ', '') END) AS last
    FROM normalized
  ), abbreviated AS (
    SELECT id, created_at,
      CASE WHEN first IS NULL OR first LIKE '%@%' THEN 'Player'
        ELSE first || CASE WHEN last IS NOT NULL AND last NOT LIKE '%@%'
          THEN ' ' || upper(left(last, 1)) || '.' ELSE '' END
      END AS label
    FROM parts
  )
  SELECT label FROM abbreviated ORDER BY lower(label), created_at, id;
END;
$$;
REVOKE ALL ON FUNCTION public.get_venue_program_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_venue_program_roster(uuid) TO authenticated;
