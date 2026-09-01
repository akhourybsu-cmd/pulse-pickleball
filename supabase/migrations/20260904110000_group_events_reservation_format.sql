-- =====================================================================
-- A court reservation, and a court closure, are each their own kind of session.
--
-- group_events.event_format allows open_play | round_robin | practice |
-- social | clinic | other. A court booking is none of those: calling it
-- 'practice' would make it show up in programming lists as though the venue
-- had scheduled it, and 'other' loses the distinction entirely.
--
-- It matters because a venue's three surfaces are the same table filtered
-- three ways:
--   • Book  — `reservation`: someone is holding a court.
--   • Play  — programming: the venue is running something people can join.
--   • Ops   — `maintenance`: the court is closed and nobody can have it.
--
-- A closure has to occupy the court exactly like a booking does (so the grid
-- won't offer it) while never appearing as something to join. Without its own
-- format it would either be invisible to the grid or advertised on Play as an
-- event, and both are wrong.
--
-- Idempotent: safe to run again if an earlier version of this migration has
-- already been applied.
-- =====================================================================

BEGIN;

ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_event_format_check;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_event_format_check
  CHECK (event_format IN (
    'open_play', 'round_robin', 'practice', 'social', 'clinic', 'other',
    'reservation', 'maintenance'
  ));

COMMENT ON COLUMN public.group_events.event_format IS
  'What kind of session this is. `reservation` is a court held by a player or '
  'by staff; `maintenance` is a court closed by staff and joinable by nobody; '
  'every other value is programming the venue or group is running. The venue '
  'Book tab shows reservations, Play shows programming, both are blocked by '
  'maintenance.';

COMMIT;
