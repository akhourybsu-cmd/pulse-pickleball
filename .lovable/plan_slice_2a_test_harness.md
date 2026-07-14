# Slice 2a-T — Test Harness Handoff

## Status

Scaffold landed. Slice 3 will begin in Claude Code per user direction; this
document records exactly what is (and is not) in place so that work can
continue without re-litigating decisions.

## What was created

- `tests/rr_slice2a/README.md` — how to run, what each scenario asserts,
  and the checklist mirroring the approved contract.
- `tests/rr_slice2a/harness.ts` — env-driven Supabase client bootstrap,
  RPC caller, event snapshotter, and `assertNoWrites` helper.
- `tests/rr_slice2a/scenarios.spec.ts` — vitest suite that:
  - auto-skips when env vars are absent (cannot mis-target a project);
  - implements the six lowest-risk scenarios (auth, input validation,
    preview no-writes, idempotency replay, idempotency conflict, stale
    version);
  - lists the remaining ten scenarios as `it.todo` with exact names so
    coverage is visible in the runner.

## What was intentionally NOT done

- **No devDeps added.** `vitest` and `@supabase/supabase-js` are not yet
  added to `package.json` — Slice 3 chooses the runner and installs it.
  Adding a test runner mid-slice would churn the app dependency graph and
  the user asked to defer.
- **No fixtures.** No test event is seeded. The scaffold refuses to run
  without an explicit `TEST_EVENT_ID` so it cannot mutate a real event.
- **No CI wiring.** No workflow file was added.
- **No production run.** The suite has not been executed against any
  database.

## Why a SQL-only harness was rejected

`rr_manage_participant` reads `auth.uid()` for authorization, organizer
checks, audit `editor_id`, and the mutation ledger. A migration `DO`
block runs as the migration role with no `auth.uid()`, so it cannot
exercise the RPC end-to-end. Any workaround (test-mode actor override,
service-role bypass) would weaken the security posture that Slice 2a
just hardened. The vitest scaffold with a real signed-in session is the
correct shape.

## Slice 3 preconditions (for Claude Code)

1. Provision a disposable project with all `20260714*` migrations applied.
2. Seed a small round-robin event and capture its id + participant ids.
3. Add `vitest` + `@supabase/supabase-js` as devDeps and a `test` script.
4. Fill in the `it.todo` scenarios.
5. Only then wire the fairness planner on top of the verified RPC.

## Confirmations

- No organizer UI wired.
- Slice 3 not started.
- No changes to the RPC, schedule schema, or audit surface in this pass.
