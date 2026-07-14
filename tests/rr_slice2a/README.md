# Slice 2a Integration Test Harness

The `rr_manage_participant` RPC requires an authenticated Supabase session
(`auth.uid()` is used for authorization, audit `editor_id`, and organizer
checks). It therefore cannot be exercised from a raw migration or the SQL
console — a real signed-in client is required.

This harness is a **scaffold** for Slice 3 (Claude Code) to complete and run.
Each scenario is written as a `vitest` test that calls the RPC through the
`@supabase/supabase-js` client on behalf of a seeded organizer account.

## What's here

- `harness.ts` — bootstraps a Supabase client, seeds/tears down a
  disposable round-robin event, exposes helpers (`callRpc`, `snapshotEvent`,
  `assertNoWrites`, `newRequestId`).
- `scenarios.spec.ts` — one `it()` per required scenario from the Slice 2a
  hardening + completion contracts. Scenarios that need infra not yet in
  place are `it.todo(...)` so the suite is honest about coverage.

## What must be wired before running

1. **Test project + credentials.** Do NOT run against production. Point
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` at a disposable project that has
   all Slice 2a migrations applied.
2. **Organizer + participant fixtures.** Provide `TEST_ORGANIZER_EMAIL` and
   `TEST_ORGANIZER_PASSWORD` for a pre-provisioned account with organizer
   rights, plus a set of already-registered player profile IDs supplied via
   `TEST_PARTICIPANT_IDS` (comma-separated UUIDs).
3. **Vitest.** `bun add -D vitest @supabase/supabase-js` and a
   `"test": "vitest run"` script in `package.json`. Kept out of this
   scaffold to avoid churning the app's dependency graph before Slice 3
   confirms the runner choice.

## Scenario checklist (mirrors the approved contract)

- Auth: unauthenticated caller → `not_authenticated` (42501).
- Input validation: unknown action, unknown regen mode, missing IDs.
- Preview mode: returns a plan **and writes nothing** — no schedule rows,
  no participant state change, no audit row, and no ledger row.
- Idempotency replay: same `p_request_id` + identical inputs returns the
  stored response byte-for-byte.
- Idempotency conflict: same `p_request_id` + different inputs raises
  `idempotency_conflict`.
- Optimistic version: stale `p_expected_version` raises `stale_version`
  (40001, `retryable: true`).
- Active-match resolution: unresolved active match raises
  `active_match_resolution_required`; each of `finish_and_record`,
  `abandon`, `restart_with_substitute` produces the expected schedule
  supersession without clearing any historical score row.
- Substitute identity: `replace` where the substitute already participates
  raises `duplicate_participant_identity`.
- Guest validation: bad name length, invalid gender, and unconfirmed
  likely-duplicate payloads all raise; a well-formed guest substitute
  flips `rating_eligible` to false and emits the audit row.
- Restore: `restore` where the replacement is still active raises
  `restore_replacement_conflict`; restore with no future rounds returns
  the `no_future_rounds` success signal.
- Regen mode: `reoptimize` for schedules Slice 2a cannot repair returns
  `reoptimization_required` without mutating anything.
- Counted view: `round_robin_schedule_counted` excludes voided,
  superseded, abandoned, and incomplete-score rows.

## How to run (once wired)

```
bun run test tests/rr_slice2a
```
