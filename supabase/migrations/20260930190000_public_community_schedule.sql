-- Public landing pages expose published program information only. No chat,
-- attendee identities, private rentals, internal holds or payment records.
CREATE OR REPLACE FUNCTION public.get_public_community_programs(p_group_id uuid, p_offset integer DEFAULT 0)
RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id',e.id,'title',e.title,'description',e.description,
    'start_time',e.start_time,'end_time',e.end_time,'event_format',e.event_format,
    'capacity',e.capacity,'skill_level_min',e.skill_level_min,'skill_level_max',e.skill_level_max,
    'price_cents',e.price_cents,'currency',e.currency,'registration_paused',e.registration_paused
  )
  FROM public.group_events e JOIN public.groups g ON g.id=e.group_id
  WHERE e.group_id=p_group_id
    AND public.get_public_community(p_group_id,NULL) IS NOT NULL
    AND e.venue_id IS NOT DISTINCT FROM g.venue_id
    AND e.parent_event_id IS NULL AND e.canceled_at IS NULL
    AND e.event_format IN ('open_play','clinic','practice','round_robin','social','other')
    AND coalesce(e.end_time,e.start_time)>now()
  ORDER BY e.start_time,e.id
  LIMIT 25 OFFSET greatest(0,least(coalesce(p_offset,0),10000))
$$;
REVOKE ALL ON FUNCTION public.get_public_community_programs(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_community_programs(uuid,integer) TO anon,authenticated,service_role;
