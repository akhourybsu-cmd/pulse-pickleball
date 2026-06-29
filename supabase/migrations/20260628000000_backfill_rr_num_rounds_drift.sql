-- Backfill round_robin_events.num_rounds for events whose stored value
-- has drifted past the actual generated schedule.
--
-- Cause (now fixed forward in generate-round-robin-schedule edge function):
-- num_rounds was stamped at wizard time using formData.maxPlayers (the
-- registration cap), but the schedule was generated later using the
-- actual confirmed seat count. The generator correctly produced fewer
-- rounds when fewer players turned up, but the event row kept the
-- inflated estimate — so the UI showed "Round X of N" with N rounds
-- that never had matches inserted, and handleCloseRound would try to
-- advance into the empty tail.
--
-- This one-shot statement re-syncs num_rounds to the actual max round
-- number that has scheduled matches. Events without a schedule are left
-- alone (they'll be sized correctly the next time generate runs).
--
-- Includes the "Testing Again" sandbox event explicitly via this same
-- generic rule — no special-casing needed; if its schedule has fewer
-- max(round_no) than num_rounds, it gets corrected here.

UPDATE round_robin_events e
SET num_rounds = s.actual_rounds
FROM (
  SELECT event_id, MAX(round_no) AS actual_rounds
  FROM round_robin_schedule
  GROUP BY event_id
) s
WHERE e.id = s.event_id
  AND s.actual_rounds > 0
  AND e.num_rounds <> s.actual_rounds;
