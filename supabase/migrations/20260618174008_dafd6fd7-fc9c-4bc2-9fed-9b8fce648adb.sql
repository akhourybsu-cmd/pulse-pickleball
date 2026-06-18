
-- Add group linking to round robin events
ALTER TABLE public.round_robin_events
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_visibility text NOT NULL DEFAULT 'personal'
    CHECK (group_visibility IN ('personal','private_group','shared_group'));

CREATE INDEX IF NOT EXISTS round_robin_events_group_id_date_idx
  ON public.round_robin_events(group_id, date);

-- Update SELECT policy to allow group-member access
DROP POLICY IF EXISTS "Users can view their events" ON public.round_robin_events;
CREATE POLICY "Users can view their events" ON public.round_robin_events
  FOR SELECT
  USING (
    (auth.uid() = organizer_id)
    OR public.is_event_participant(id, auth.uid())
    OR ((is_published = true) AND (registration_mode = 'open_registration'::text))
    OR (group_id IS NOT NULL AND group_visibility IN ('private_group','shared_group')
        AND public.is_group_member(auth.uid(), group_id))
  );

-- Enforce that linking to a group requires admin in that group
DROP POLICY IF EXISTS "Organizers can create events" ON public.round_robin_events;
CREATE POLICY "Organizers can create events" ON public.round_robin_events
  FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id
    AND (group_id IS NULL OR public.is_group_admin(auth.uid(), group_id))
  );

DROP POLICY IF EXISTS "Organizers can update their events" ON public.round_robin_events;
CREATE POLICY "Organizers can update their events" ON public.round_robin_events
  FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (
    auth.uid() = organizer_id
    AND (group_id IS NULL OR public.is_group_admin(auth.uid(), group_id))
  );

-- Extend group_posts to support round_robin posts
ALTER TABLE public.group_posts DROP CONSTRAINT IF EXISTS group_posts_type_check;
ALTER TABLE public.group_posts
  ADD CONSTRAINT group_posts_type_check
  CHECK (type = ANY (ARRAY['feed'::text, 'lfg'::text, 'announcement'::text, 'highlight'::text, 'poll'::text, 'round_robin'::text]));

ALTER TABLE public.group_posts
  ADD COLUMN IF NOT EXISTS round_robin_event_id uuid REFERENCES public.round_robin_events(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS group_posts_round_robin_event_id_idx
  ON public.group_posts(round_robin_event_id);
