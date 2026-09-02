-- =====================================================================
-- Venue programming: one public event, several conflict-safe court holds.
--
-- A clinic or open play should appear once to players and have one RSVP list,
-- even when it occupies several courts. `program_hold` children claim each
-- physical court using the existing group_events overlap constraint, while
-- parent_event_id ties those invisible operational rows to the public event.
-- =====================================================================

BEGIN;

ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS parent_event_id uuid
  REFERENCES public.group_events(id) ON DELETE CASCADE;

ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS rotation_style text;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_rotation_style_check;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_rotation_style_check
  CHECK (
    rotation_style IS NULL OR rotation_style IN (
      'paddle_stack', 'timed_rotation', 'winners_stay',
      'organized_games', 'coach_led'
    )
  );

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_event_format_check;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_event_format_check
  CHECK (event_format IN (
    'open_play', 'round_robin', 'practice', 'social', 'clinic', 'other',
    'reservation', 'maintenance', 'program_hold'
  ));

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_program_hold_shape;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_program_hold_shape
  CHECK (
    event_format <> 'program_hold'
    OR (
      parent_event_id IS NOT NULL
      AND venue_id IS NOT NULL
      AND venue_court_id IS NOT NULL
      AND end_time IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_group_events_parent_event
  ON public.group_events(parent_event_id)
  WHERE parent_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_events_one_hold_per_event_court
  ON public.group_events(parent_event_id, venue_court_id)
  WHERE parent_event_id IS NOT NULL AND venue_court_id IS NOT NULL;

COMMENT ON COLUMN public.group_events.parent_event_id IS
  'For program_hold rows, the public RSVP-able venue program whose court this '
  'row claims. Deleting the parent releases every allocated court.';

COMMENT ON COLUMN public.group_events.rotation_style IS
  'Pickleball-specific player flow: paddle stack, timed rotation, winners '
  'stay, organized games, or coach-led.';

-- Owners/managers/organizers operate the venue even when they are not also a
-- member of its community. Keep the existing community permission branch and
-- add venue authority as a second, tightly matched branch.
DROP POLICY IF EXISTS "Permitted members can create events" ON public.group_events;
CREATE POLICY "Permitted members can create events"
  ON public.group_events FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND (
      (
        public.is_group_member(auth.uid(), group_id)
        AND (
          public.has_group_role(auth.uid(), group_id, 'owner'::group_role)
          OR (
            public.has_group_role(auth.uid(), group_id, 'moderator'::group_role)
            AND COALESCE((
              SELECT (g.settings->>'moderators_can_create_events')::boolean
              FROM public.groups g WHERE g.id = group_id
            ), true)
          )
          OR COALESCE((
            SELECT (g.settings->>'allow_member_events')::boolean
            FROM public.groups g WHERE g.id = group_id
          ), true)
        )
      )
      OR (
        venue_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.groups g
          JOIN public.venue_staff vs ON vs.venue_id = g.venue_id
          WHERE g.id = group_id
            AND g.venue_id = group_events.venue_id
            AND vs.user_id = auth.uid()
            AND vs.role::text IN ('owner', 'manager', 'organizer')
            AND vs.is_active IS NOT FALSE
            AND (vs.status IS NULL OR vs.status::text = 'active')
        )
      )
    )
  );

DROP POLICY IF EXISTS "Venue programmers can update events" ON public.group_events;
CREATE POLICY "Venue programmers can update events"
  ON public.group_events FOR UPDATE TO authenticated
  USING (
    venue_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.venue_staff vs
      WHERE vs.venue_id = group_events.venue_id
        AND vs.user_id = auth.uid()
        AND vs.role::text IN ('owner', 'manager', 'organizer')
        AND vs.is_active IS NOT FALSE
        AND (vs.status IS NULL OR vs.status::text = 'active')
    )
  )
  WITH CHECK (
    venue_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.venue_staff vs
      WHERE vs.venue_id = group_events.venue_id
        AND vs.user_id = auth.uid()
        AND vs.role::text IN ('owner', 'manager', 'organizer')
        AND vs.is_active IS NOT FALSE
        AND (vs.status IS NULL OR vs.status::text = 'active')
    )
  );

DROP POLICY IF EXISTS "Venue programmers can delete events" ON public.group_events;
CREATE POLICY "Venue programmers can delete events"
  ON public.group_events FOR DELETE TO authenticated
  USING (
    venue_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.venue_staff vs
      WHERE vs.venue_id = group_events.venue_id
        AND vs.user_id = auth.uid()
        AND vs.role::text IN ('owner', 'manager', 'organizer')
        AND vs.is_active IS NOT FALSE
        AND (vs.status IS NULL OR vs.status::text = 'active')
    )
  );

COMMIT;
