-- Event format + waitlist configuration on community events
ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS event_format text NOT NULL DEFAULT 'open_play',
  ADD COLUMN IF NOT EXISTS waitlist_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_limit integer,
  ADD COLUMN IF NOT EXISTS series_id uuid,
  ADD COLUMN IF NOT EXISTS rr_courts integer,
  ADD COLUMN IF NOT EXISTS rr_games_per_player integer;

ALTER TABLE public.group_events DROP CONSTRAINT IF EXISTS group_events_event_format_check;
ALTER TABLE public.group_events ADD CONSTRAINT group_events_event_format_check
  CHECK (event_format IN ('open_play','round_robin','practice','social','clinic','other'));

ALTER TABLE public.group_event_rsvps
  ADD COLUMN IF NOT EXISTS waitlist_position integer;

CREATE INDEX IF NOT EXISTS idx_group_events_series ON public.group_events(series_id);
CREATE INDEX IF NOT EXISTS idx_group_event_rsvps_event_status ON public.group_event_rsvps(event_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_events TO authenticated;
GRANT SELECT ON public.group_events TO anon;
GRANT ALL ON public.group_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_event_rsvps TO authenticated;
GRANT SELECT ON public.group_event_rsvps TO anon;
GRANT ALL ON public.group_event_rsvps TO service_role;

-- Only owners, permitted moderators, or members allowed by group settings may create events
DROP POLICY IF EXISTS "Members can create events" ON public.group_events;
DROP POLICY IF EXISTS "Permitted members can create events" ON public.group_events;
CREATE POLICY "Permitted members can create events" ON public.group_events
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND public.is_group_member(auth.uid(), group_id)
  AND (
    public.has_group_role(auth.uid(), group_id, 'owner'::group_role)
    OR (
      public.has_group_role(auth.uid(), group_id, 'moderator'::group_role)
      AND COALESCE((SELECT (g.settings->>'moderators_can_create_events')::boolean FROM public.groups g WHERE g.id = group_id), true)
    )
    OR COALESCE((SELECT (g.settings->>'allow_member_events')::boolean FROM public.groups g WHERE g.id = group_id), true)
  )
);

-- Promote the earliest waitlisted members into open spots
CREATE OR REPLACE FUNCTION public.promote_group_event_waitlist(p_event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event group_events;
  v_going integer;
  v_promoted integer := 0;
  v_row record;
BEGIN
  SELECT * INTO v_event FROM group_events WHERE id = p_event_id;
  IF NOT FOUND OR v_event.capacity IS NULL OR NOT v_event.waitlist_enabled THEN
    RETURN 0;
  END IF;

  SELECT count(*) INTO v_going FROM group_event_rsvps
   WHERE event_id = p_event_id AND status = 'going';

  FOR v_row IN
    SELECT id, user_id FROM group_event_rsvps
     WHERE event_id = p_event_id AND status = 'waitlist'
     ORDER BY waitlist_position NULLS LAST, created_at
  LOOP
    EXIT WHEN v_going >= v_event.capacity;
    UPDATE group_event_rsvps
       SET status = 'going', waitlist_position = NULL, updated_at = now()
     WHERE id = v_row.id;
    v_going := v_going + 1;
    v_promoted := v_promoted + 1;

    INSERT INTO user_notifications (user_id, notification_type, category, title, message, link, priority)
    VALUES (
      v_row.user_id, 'waitlist_promoted', 'events', 'You''re in!',
      'A spot opened up for "' || v_event.title || '". You are now confirmed.',
      '/player/community/group/' || v_event.group_id, 'high'
    );
  END LOOP;

  RETURN v_promoted;
END;
$$;

-- Single entry point for joining/leaving a community event with capacity + waitlist logic
CREATE OR REPLACE FUNCTION public.set_group_event_rsvp(p_event_id uuid, p_status text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_event group_events;
  v_going integer;
  v_wait integer;
  v_final text := p_status;
  v_pos integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_status NOT IN ('going','maybe','not_going','waitlist') THEN
    RAISE EXCEPTION 'Invalid RSVP status';
  END IF;

  SELECT * INTO v_event FROM group_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF NOT is_group_member(v_uid, v_event.group_id) THEN
    RAISE EXCEPTION 'Join this community to RSVP';
  END IF;

  IF p_status = 'going' AND v_event.capacity IS NOT NULL THEN
    SELECT count(*) INTO v_going FROM group_event_rsvps
     WHERE event_id = p_event_id AND status = 'going' AND user_id <> v_uid;
    IF v_going >= v_event.capacity THEN
      IF NOT v_event.waitlist_enabled THEN
        RAISE EXCEPTION 'This event is full';
      END IF;
      SELECT count(*) INTO v_wait FROM group_event_rsvps
       WHERE event_id = p_event_id AND status = 'waitlist' AND user_id <> v_uid;
      IF v_event.waitlist_limit IS NOT NULL AND v_wait >= v_event.waitlist_limit THEN
        RAISE EXCEPTION 'The waitlist for this event is full';
      END IF;
      v_final := 'waitlist';
    END IF;
  END IF;

  IF v_final = 'waitlist' THEN
    SELECT COALESCE(max(waitlist_position), 0) + 1 INTO v_pos
      FROM group_event_rsvps WHERE event_id = p_event_id;
  ELSE
    v_pos := NULL;
  END IF;

  INSERT INTO group_event_rsvps (event_id, user_id, status, waitlist_position)
  VALUES (p_event_id, v_uid, v_final, v_pos)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status,
                waitlist_position = CASE WHEN EXCLUDED.status = 'waitlist'
                                         THEN COALESCE(group_event_rsvps.waitlist_position, EXCLUDED.waitlist_position)
                                         ELSE NULL END,
                updated_at = now();

  IF v_final <> 'going' THEN
    PERFORM promote_group_event_waitlist(p_event_id);
  END IF;

  RETURN v_final;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_group_event_waitlist(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_group_event_rsvp(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_event_rsvp(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_group_event_waitlist(uuid) TO authenticated, service_role;