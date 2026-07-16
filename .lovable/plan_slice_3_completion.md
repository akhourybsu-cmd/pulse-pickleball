# Slice 3 — Pure TypeScript planner (2026-07-16)

Implements Slice 3 per `.lovable/plan_slice_2a_amendments.md` Amendment 4 and
`.lovable/plan.md` §2/§3/§6/§8. Sequencing is **2a → 3 → 2b → 4**; this is the
"3". No organizer UI is wired; the DB RPC surface is unchanged.

## What shipped

- `src/lib/roundRobin/scheduleCore.ts` — deterministic, DB-free scheduling
  primitives extracted from the `generate-round-robin-schedule` edge function
  (seeded RNG, player stats, partner/opponent penalties, team formation, bye
  assignment, `regenerateRounds`). The edge function itself is **unchanged**;
  Slice 2b will unify the two callers on this core.
- `src/lib/roundRobin/scoreRemainingSchedule.ts` — the pure planner
  `scoreRemainingSchedule(state, change): ParticipantChangePlan`:
  - Protection-level classification (`isHistoricallyLocked` /
    `isOperationallyProtected` / `isReoptimizable`) per §3.
  - Minimal local repair for withdraw/injure/remove: pulls an idle active seat
    into the vacated slot and seats the outgoing player on the freed bye, so the
    round stays balanced with no double-booking. Emits `swap_identity` ops —
    the same op vocabulary the existing `rr_manage_participant` apply loop
    understands.
  - `replace` as identity swap across future unlocked rows, with the §4/§12
    identity-uniqueness guard.
  - `restore` folds the player back into reoptimizable future rounds, or returns
    `reason: "no_future_rounds"` when there is nothing left to schedule.
  - Fairness metrics (`projectedGameSpread`, `projectedByeSpread`,
    `partnerRepeatMax`) plus deterministic guardrails from §6.
  - Real `minimal` / `reoptimize` / `auto` handling. `auto` prefers minimal and
    escalates to a full `reoptimize` of the reoptimizable rounds when minimal is
    impossible or trips a guardrail — replacing Slice 2a's
    `reoptimization_required` stub with an actual plan.

The planner is **pure**: no DB, no network, no wall-clock, no `Math.random`.
Same inputs → identical `ParticipantChangePlan`. Division of authority is
unchanged (Amendment 4): the planner decides what is *preferable*; the DB RPC
still decides what is *safe to commit*.

## Tests & tooling

- `vitest` added as a devDep with `test` / `test:watch` scripts and
  `vitest.config.ts` (the runner choice deferred to Slice 3 by the test-harness
  handoff). This also un-gates `tests/rr_slice2a`, which still auto-skips
  without its env vars.
- `src/lib/roundRobin/scheduleCore.test.ts` and
  `scoreRemainingSchedule.test.ts` — 32 passing unit tests covering minimal
  repair success/failure, replace identity swaps + all replace guards, restore
  (fold-back / no-future / terminal / already-active), auto escalation,
  reoptimize validity + determinism, protection classification, and the
  fairness evaluator.
- `bun run test` → 32 passed. `tsc -p tsconfig.app.json --noEmit` clean.
  `eslint` clean on new files. `vite build` succeeds.

## Explicitly still deferred

- **Slice 2b** server orchestration (Edge Function that snapshots, runs this
  planner, and calls the apply RPC with `expected_version` + plan hash). Until
  it lands, `rr_manage_participant` keeps its local-repair-only planner and
  returns `reoptimization_required` for reoptimize/auto-escalation.
- **Integration harness** `it.todo`s in `tests/rr_slice2a` — they exercise the
  live RPC and require a disposable Supabase project + organizer credentials,
  which are out of reach from a pure unit-test environment.
- **Organizer UI / standings / rating recompute** — Slice 4/5.

## Note on lockfiles

This is a bun-primary project. `vitest` is recorded in `package.json`
devDependencies; `bun install` resolves it on the next run. The secondary
`package-lock.json` was intentionally left untouched to avoid churning
unrelated transitive versions.
