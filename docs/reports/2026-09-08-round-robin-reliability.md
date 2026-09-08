# Round-robin completion, kiosk and session reliability

## Scope and observed behavior

Investigated the host's report of failure closing Round 1, intermittent kiosk
loading errors and possible unexpected sign-outs. Android release work was
paused; the existing three Android Gradle-file modifications were preserved.

The supplied live test event was already on Round 2 when inspected:
`b3f09342-ee59-4788-a607-5ad4f88ddd4d` (League Test). It has eight guests,
three rounds and three courts, and is not rating eligible. The original
Round 1 failure and an actual sign-out were not reproduced. Intermittent
authenticated event-refresh failures were reproduced during live verification.
The old console output exposed only `Object`, so their underlying transport or
database cause was not established. A manual Retry recovered without signing in.

## Changes

- Added `rr_close_round`: organizer/admin authorization, event and schedule
  locking, expected-round validation, canonical-score completeness checks,
  abandoned-game handling, next-round checks, atomic advancement and audit entry.
  Empty rounds, pending scores, final rounds and stale requests are rejected.
- Host completion checks the RPC result and prevents duplicate clicks and
  completion while a score is saving. A server-confirmed advance is reflected
  immediately, even if the subsequent full refresh fails.
- Event reads keep the last good data, reject stale responses, have a 20-second
  deadline and expose Retry. Read errors now log a useful error code/message.
  Write operations are not automatically retried or given ambiguous timeouts.
- Removed per-refresh `getUser()` redirects. The shared auth provider and route
  guard own authentication; transient session-read failures do not pretend the
  user signed out. Database RLS still enforces access.
- Kiosk uses a separate, session-independent public client (no second GoTrue
  auth client), one canonical snapshot, cancellable reads, coalesced realtime
  refreshes, polling/retries and last-good-data recovery with a reconnect notice.
  Existing public-event policies and the public participant-name RPC remain the
  authorization boundary; no private profile access was added.

## Deployment and checks

- Database commit: `8e38a3bc354cfb1c69eb971a3f51306bc2681414`.
  [Successful Supabase deployment](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34280629519)
  applied only `20260915100000_atomic_round_robin_round_completion.sql` to
  `rqfqwavhtfwwtmfjnxkx`: 426 local migrations, 425 previously recorded, one applied.
- Frontend commits: `05fbb7959df3515e657d144c858296b7375caaec` and
  `eca15407a9fdd389387ee2ff14c6257be3696979`.
  [Final successful Firebase live deployment](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34282138590)
  passed 759 tests across 59 files; 32 tests were skipped and 10 remain todo.
  Production Vite build succeeded.
- Tests execute the actual round-close SQL with PGlite, including reapplication,
  authorization, stale requests, incomplete scores, abandoned games and rollback.
  Additional tests cover kiosk public-key use without auth requests, hung-read
  cancellation, snapshot retention/recovery and auth-error classification.
- Repository-wide TypeScript checking still reports preexisting unrelated
  errors. The changed files had no remaining diagnostics on the final focused
  check. The production build is not a substitute for a clean repository-wide
  type check.

## Live test changes and final state

With the user's permission to use this test event, saved two sample Round 2
scores through the production host UI:

- Court 2: John Brouwer / Arnav Sodhani **11-7** David Archard / Bonnie Rivers.
- Court 3: Arlene T / CJ Blando **11-9** Christian G / Jerry Smith.

Both scores appeared automatically in the production kiosk. Clicking Close
Round 2 successfully advanced the database and kiosk to Round 3. The subsequent
host refresh failed transiently and recovered with Retry, prompting the final
confirmed-state/read-deadline follow-up fix. After that deployment, reloading
the host page showed Round 3 and the saved scores without another sign-in or a
new logged browser error. The kiosk remained live on Round 3.

Round 1 scores were not changed. Round 3 was left unscored and the event remains
live and unfinished. No rating submission or other event mutation was performed.
The production kiosk tab was left available for the user.

## Remaining verification limits

- The reporting device (phone browser, installed Android app or desktop) was
  asked about but not established. The installed Android package was not updated
  or tested by this pass.
- Browser network-failure injection was unavailable. Recovery and timeout paths
  were tested with mocked network/QueryClient tests; actual intermittent host
  read failure and successful Retry were observed in production.
- The server-confirmed-state follow-up was code-reviewed and deployed, but the
  completed Round 2 was not reset merely to repeat the same advance test.
- This is not a multi-host concurrency/load test or an assurance against every
  possible future session/network failure.

## SQL copy/paste

The complete, already-applied SQL is in
`supabase/migrations/20260915100000_atomic_round_robin_round_completion.sql`.
No manual database action is required.
