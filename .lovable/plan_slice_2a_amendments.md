# Slice 2a Amendments (approved 2026-07-14)

This document records the amendments layered on top of the v2 contract
in `.lovable/plan.md`. Where this file conflicts with v2, this file wins
for the 2a implementation.

## Split approved

- **Slice 2a** (now): schema + RPC + planner surface + idempotency +
  active-match resolution + local-repair-only planner + invariants +
  tests. Ships to the development branch. **Not wired into any organizer
  UI.**
- **Slice 3**: pure TypeScript planner
  `scoreRemainingSchedule(state, requestedChange): ParticipantChangePlan`
  (no DB, no UI, no network; deterministic; unit tested).
- **Slice 2b**: internal server-side orchestration (Edge Function) that
  authenticates, snapshots, runs the TS planner, and calls the
  transactional apply RPC with expected version + plan hash. Enables
  `reoptimize` / `auto` end-to-end. The DB RPC surface does NOT change
  between 2a and 2b; only the planner behind it does.
- **Slice 4+**: organizer UI, standings, rating recompute (unchanged).

Numbering: **2a → 3 → 2b → 4**.

## Amendment 1 — Slice 2a is infrastructure-complete only

Slice 2a does not "complete withdrawal & substitution scheduling". It
delivers the transactional foundation. Organizer UI must remain gated
until 2b lands.

## Amendment 2 — Error semantics: `reoptimization_required`

- `minimal_regen_not_possible` is reserved for
  `p_regen_mode = 'minimal'` when no valid local repair exists.
- New error `reoptimization_required` is returned when:
  - `p_regen_mode = 'auto'` AND the minimal candidate fails guardrails,
    OR
  - `p_regen_mode = 'reoptimize'` (in 2a, always — reoptimize is not
    yet implemented server-side).
- `fairness_triggers` describes **schedule conditions**
  (`projected_game_spread_exceeds_one`, `bye_count_imbalance`, etc.)
  never implementation status. **Do not emit
  `reoptimize_not_yet_implemented`.**
- Auto with a valid minimal candidate that passes guardrails succeeds
  normally.

Response shape on escalation:

```json
{
  "code": "reoptimization_required",
  "message": "A valid local repair is not sufficient. Full remaining-schedule optimization is required.",
  "retryable": false,
  "fairness_triggers": ["projected_game_spread_exceeds_one"]
}
```

## Amendment 3 — No pg_net / HTTP from inside the RPC

The DB RPC must not call `pg_net`, `http`, or any Edge Function
synchronously while holding the event lock. Rejected because:

- network failure inside a critical mutation
- unclear transaction semantics
- timeout while holding locks
- retry ambiguity / duplicate planner runs
- false impression of atomicity

## Amendment 4 — Architecture for Slice 3 / 2b

1. **Pure TS planner (Slice 3):**
   `scoreRemainingSchedule(state, requestedChange): ParticipantChangePlan`
   — no DB, no UI, no network, deterministic, unit tested.
2. **Server orchestration (Slice 2b, internal Edge Function):**
   authenticate → snapshot → run TS planner → preview OR immediately
   call apply RPC with `expected_version` + full proposed plan +
   canonical plan hash.
3. **Transactional apply RPC (this slice + refined in 2b):**
   locks event row, revalidates auth, revalidates `schedule_version`,
   validates plan matches requested action, validates every invariant,
   rejects mutations to historically locked matches, applies atomically,
   bumps `schedule_version` exactly once, stores plan hash + idempotency
   response.

Division of authority: **planner decides what is preferable; DB decides
what is safe to commit.**

## Amendment 5 — Stable public TS surface

Client always calls the server orchestration layer, never composes
plans. The raw apply RPC is treated as internal privileged even while
`EXECUTE` is granted to `authenticated`. Public TS interface:

```ts
previewParticipantChange(input)
manageParticipant(input)
```

Implementation of these transitions from local-repair-only (2a) to full
TS planner (2b) with no UI contract change.

## Amendment 6 — No `xit` on core contractual cases

Every 2a-claimed behavior gets a passing test. Escalation cases assert
that `reoptimization_required` is returned. A separate 2b test checklist
is documented; when 2b lands, those temporary expectations flip to full
success expectations.

## Amendment 7 — Do not drop `original_schedule_id` in this slice

Do:

1. Add `supersedes_schedule_id`, `superseded_by_schedule_id` (directional).
2. Backfill from `original_schedule_id` where meaningful.
3. Update readers over the next slices.
4. Mark `original_schedule_id` deprecated in a code comment / migration note.
5. Drop it in a later verified migration once no reader references it.

The 2a migration adds the new columns and backfills; it does **not**
drop `original_schedule_id`.

## Amendment 8 — Do not auto-create `rr_rpc_owner`

Existing project SECURITY DEFINER functions are owned by `postgres`
(verified: `submit_rr_match_score`, `void_round_robin_event`,
`delete_round_robin_event`, `has_role`, `rr_events_set_invite_code`).
Follow the established pattern: **owner = `postgres`**. Do not create
`rr_rpc_owner`.

Regardless of owner:

- fully qualify all objects
- `SET search_path = public, pg_catalog`
- `REVOKE ALL ... FROM PUBLIC, anon`
- `GRANT EXECUTE ... TO authenticated`
- planner helper is not granted to any role (called only from the RPC)

## Amendment 9 — Checkpoint after 2a

Stop and report before starting Slice 3. Report must include: final RPC
+ planner contracts, what's implemented vs deferred, schema/migration
diff, deprecated-but-not-removed columns, idempotency behavior, preview
behavior, active-match resolution results, score-history preservation
proof, local-repair behavior, `reoptimization_required` behavior,
authorization + grants, invariant tests, concurrency + stale-version
tests, complete test output, confirmation no organizer UI is wired,
confirmation Slice 3 hasn't begun.
