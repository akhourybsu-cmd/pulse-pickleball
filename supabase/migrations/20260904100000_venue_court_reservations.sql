-- =====================================================================
-- Venue court reservations.
--
-- A reservation is a group_event on a specific court — the same table as open
-- play, clinics and every other session — so a booking carries RSVPs, appears
-- in Pulse discovery, and can become a round robin whose results count. No
-- parallel booking model.
--
-- The one thing missing was the court itself. `group_events.court_id` points
-- at `courts`, which is a LOCATION table (city, state, location, citi_admins),
-- not a playing surface. Individual courts live in `venue_courts`
-- (court_number, surface_type, hourly_rate). So nothing could express
-- "Court 3, 9-10am" until now.
-- =====================================================================

BEGIN;

-- Overlap exclusion needs to mix an equality test (same court) with a range
-- test (overlapping time) in one index.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.group_events
  ADD COLUMN IF NOT EXISTS venue_court_id uuid
  REFERENCES public.venue_courts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.group_events.venue_court_id IS
  'The specific playing surface this session occupies, for venue court '
  'reservations. NULL for sessions that are not tied to one court. Distinct '
  'from court_id, which references the `courts` LOCATION table.';

-- A reservation with no end time cannot be scheduled against, and would make
-- the overlap constraint below meaningless. Only enforced when a court is
-- actually claimed, so every other kind of event is untouched.
ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_court_needs_end_time;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_court_needs_end_time
  CHECK (venue_court_id IS NULL OR end_time IS NOT NULL);

-- Same court, overlapping time, is impossible.
--
-- This belongs in the database rather than in the booking UI: two people
-- tapping the same empty slot at the same moment is the single most likely
-- way a court reservation system corrupts itself, and no amount of client-side
-- availability checking can prevent it. The second INSERT now fails loudly
-- (23P01) instead of silently double-booking Court 3.
--
-- Half-open '[)' so a 9-10 booking and a 10-11 booking do NOT collide.
ALTER TABLE public.group_events
  DROP CONSTRAINT IF EXISTS group_events_no_court_double_booking;

ALTER TABLE public.group_events
  ADD CONSTRAINT group_events_no_court_double_booking
  EXCLUDE USING gist (
    venue_court_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (venue_court_id IS NOT NULL);

-- The availability query is "everything on these courts on this day".
CREATE INDEX IF NOT EXISTS idx_group_events_venue_court_time
  ON public.group_events (venue_court_id, start_time)
  WHERE venue_court_id IS NOT NULL;

-- Rendering a venue's day view asks for every session at the venue in a
-- window, across all its courts.
CREATE INDEX IF NOT EXISTS idx_group_events_venue_time
  ON public.group_events (venue_id, start_time)
  WHERE venue_id IS NOT NULL;

COMMIT;
