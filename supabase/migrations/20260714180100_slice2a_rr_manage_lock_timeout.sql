-- Slice 2a corrective (additive, NON-destructive): bound the lock wait in
-- rr_manage_participant so a contended event row can never hang the request
-- indefinitely (spec §J "lock timeout").
--
-- This is done as an ALTER FUNCTION ... SET so the 560-line function body is
-- NOT re-emitted here — zero behavioral drift risk. It adds a per-function
-- `lock_timeout` GUC: once the function's `SELECT ... FOR UPDATE` on the event
-- row waits longer than the timeout, Postgres aborts the statement with
-- SQLSTATE 55P03 (lock_not_available) and the whole transaction rolls back
-- (participant state, schedule, audit, version, ledger) — exactly the
-- all-or-nothing behavior the concurrency tests assert.
--
-- 3s is comfortably above a normal apply (single-row locks, small plans) yet
-- well under any client/HTTP timeout, so a genuinely stuck lock surfaces fast.
--
-- NOTE (deferred, tracked): mapping 55P03 to the *structured* envelope
-- {code:'lock_timeout', retryable:true}, and adding `invalid_final_score`
-- validation to the finish_and_record branch, both require editing the
-- function body (a full CREATE OR REPLACE). Those are intentionally NOT done
-- blind here — they will be authored and applied against an isolated
-- (local/disposable) database where they can actually be executed and tested,
-- per the takeover rule "do not claim tests pass until executed". Until then,
-- clients should treat SQLSTATE 55P03 from this RPC as a retryable lock error.

ALTER FUNCTION public.rr_manage_participant(
  uuid, uuid, uuid, text, text, integer, text, boolean, jsonb, jsonb
) SET lock_timeout = '3s';
