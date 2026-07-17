# Slice 4 — Organizer UI wiring + standings correctness (2026-07-16)

Slice 4 begins the UI/standings work deferred through Slices 2a–2b. Sequencing
is **2a → 3 → 2b → 4**. This pass delivers two safe, verifiable pieces; the rest
of Slice 4 (dedicated preview UI, rating recompute wiring) remains open.

## What shipped

### 1. Standings count only canonical rows
- `src/lib/roundRobin/standings.ts` — `countsTowardScore(row)`, a pure mirror of
  the `round_robin_schedule_counted` DB view: a row counts only if it is a real,
  played, still-canonical match (not a bye, not voided, not superseded, not
  abandoned, both scores present).
- Applied in the three client standings readers — `RoundRobinDetail`,
  `RoundRobinKiosk`, `PlayerRoundRobinView` (all fetch `select("*")`, so the
  guard columns are present). This closes the gap flagged in the Slice 2a
  completion notes: after a withdraw/abandon, restart-with-substitute, or a
  reoptimize that voids stale rows, those rows no longer keep contributing to
  standings.
- **Safe-by-construction**: the guard fields are optional, so on any reader that
  does not select them the helper behaves exactly as the old
  `!is_bye && scores present` check — it can only correct behaviour, never
  change it. 4 unit tests cover it.

### 2. Organizer roster changes route through the orchestration layer
- `handleMarkInactive` (remove) and `handleSubstitute` (global replace) in
  `RoundRobinDetail` now call the Slice 2b `manageParticipant` orchestration
  surface, so `auto`/`reoptimize` resolves cases the SQL local-repair planner
  returns `reoptimization_required` for.
- **Rollout-safe fallback**: `isInfrastructureError` (new, in
  `participantOrchestration.ts`) distinguishes a genuine application rejection
  (a known RPC/planner error code) from the orchestration layer being
  unavailable (transport failure, or PostgREST "function not found" because the
  Slice 2b edge function / migration isn't deployed yet). On an infrastructure
  error the handlers transparently fall back to the legacy direct RPC, so roster
  changes never break during rollout; on an application error the specific
  message is surfaced and the change is rejected.
- Error/throw contract preserved: both handlers still throw on failure so
  `PlayerManagementDialog` keeps itself open for a retry, and toast on success.

## Verification
- `bun run test` → **39 passed** (adds the standings-eligibility suite);
  scaffold auto-skips.
- `tsc -p tsconfig.app.json --noEmit` clean · `vite build` succeeds.
- `eslint`: the touched files carry pre-existing `no-explicit-any` errors
  (the project is not lint-clean); this pass added **zero** new lint errors
  (RoundRobinDetail: 53 before, 53 after) and the new lib files are clean.

## Depends on Slice 2b deployment
The orchestration path is only exercised once the Slice 2b migration
(`20260716210000_slice2b_apply_external_plan.sql`) and the
`rr-manage-participant` edge function are deployed. Until then the fallback keeps
the current direct-RPC behaviour. Deploy + verify per
`.lovable/plan_slice_2b_completion.md` before relying on reoptimize in the UI.

## Still open in Slice 4+
- A dedicated preview UX (show the fairness diff / rounds-touched from
  `previewParticipantChange` before applying).
- Migrating remaining standings/history readers (venue kiosk/detail variants,
  `MatchHistory`) onto `countsTowardScore` — safe to do incrementally since the
  helper is a no-op where the columns aren't selected.
- Rating recompute wiring for guest-substitute eligibility flips surfaced in the
  organizer UI.
