-- =====================================================================
-- A court reservation is its own kind of session.
--
-- group_events.event_format allows open_play | round_robin | practice |
-- social | clinic | other. A court booking is none of those: calling it
-- 'practice' would make it show up in programming lists as though the venue
-- had scheduled it, and 'other' loses the distinction entirely.
--
-- It matters because the venue's Book tab and its Play tab are the same
-- table filtered differently: a reservation is someone holding a court, a
-- programmed session is the venue running something. Without a format for
-- the first, the two cannot be told apart.
-- =====================================================================

BEGIN;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_event_format_check;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_event_format_check
  CHECK (event_format IN (
    'open_play', 'round_robin', 'practice', 'social', 'clinic', 'other',
    'reservation'
  ));

COMMENT ON COLUMN public.group_events.event_format IS
  'What kind of session this is. `reservation` is a court held by a player '
  'or by staff; every other value is programming the venue or group is '
  'running. The venue Book tab shows reservations, the Play tab shows the rest.';

COMMIT;
