# Round Robin batch-add timeout investigation

## Production evidence

The September 21 report concerns the organizer's existing-event Add Players path. API Gateway logs show a mobile POST to `round_robin_players` at 20:44:56 UTC returning HTTP 500. Its query string includes `on_conflict=id` and the batch columns `id,event_id,player_id,guest_player_id,guest_name,status`, matching `RoundRobinDetail.handleAddPlayers`.

The corresponding PostgreSQL error at 20:45:12 UTC is `57014: canceling statement due to statement timeout`. Full log attributes identify PostgREST 14.5, command `BIND`, query ID `6153701728467773830` and transaction ID `0`. The query ID matches the recorded PostgREST batch upsert. This points to query preparation rather than schedule generation or the UI transition. PostgreSQL documents that planning normally occurs during [Bind processing](https://www.postgresql.org/docs/17/protocol-flow.html).

The only event created that day at inspection time was the draft named `Test`, created at 20:26:57 UTC. It had zero roster entries and zero schedule rows. No production players, scores or schedules were changed during this investigation.

## Request path and planning

The organizer already deduplicates picks, validates the format, submits one database statement, writes an audit record and performs at most one schedule rebuild. An unscheduled draft only refreshes its roster after the save. There is no 12-player limit in this path.

Previously every batch used upsert, even when all roster UUIDs were newly generated. This makes PostgreSQL prepare UPDATE and SELECT permissions alongside INSERT permissions. The installed roster policies reference event policies, which in turn include venue and group access checks. The resulting upsert plan is substantially larger than the insert plan.

Read-only `EXPLAIN`, without `ANALYZE`, used 12 synthetic participant identities, the affected event and its organizer's authenticated role. Every diagnostic was enclosed in `BEGIN READ ONLY` and `ROLLBACK`; the insert statements were never executed.

| Request shape | Planning time | Plan nodes |
| --- | ---: | ---: |
| Plain batch insert | 117.208 ms | 32 |
| Batch upsert | 866.593 ms | 214 |
| Upsert including API insert-count bookkeeping | 803.238 ms | 214 |

An initial diagnostic attempt was canceled. Verified subsequent upsert plans completed, so the precise reason for the original approximately 16-second spike is not established. The logs confirm its stage, and the plan comparison confirms avoidable work; these measurements are not an end-to-end production save benchmark.

## Prepared correction

`persistRosterAdditions` submits a single bulk INSERT when every selected participant is new to the event. Batches including an existing inactive roster row retain the single atomic upsert so reactivation preserves that identity. Empty selections issue no request. Failed writes are not retried as individual player inserts.

The route's format validation, de-duplication, audit, refresh and single schedule-rebuild behavior are unchanged. No SQL migrations, access-policy changes or timeout increases are required. Reactivation batches still use the existing upsert path and could encounter its planning cost.

The patch is isolated on `codex/round-robin-batch-add-fix`, based on the published organizer/player release `1c5261fa`. The original development checkout's unrelated edits are preserved.

## Validation and status

- Real Supabase client with an intercepted HTTP transport: six tests cover one/12 new players and guests, a mixed reactivation batch, both timeout paths and an empty selection. The tests assert one request, the complete payload, and the presence/absence of conflict-update semantics. They never contact a live backend.
- All 17 Round Robin suites passed: 171 tests.
- Focused ESLint passed for the helper and regression tests.
- The project typecheck reports no errors in the changed route, helper or regression tests. The overall typecheck still fails on existing errors elsewhere in the project.
- The production build passed in 46.83 seconds; existing bundle-size warnings remain.
- Publication remains pending. No production mutation was submitted as a test.
