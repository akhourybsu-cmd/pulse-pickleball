# Slice 2b — Server orchestration (2026-07-16)

Implements Slice 2b per `.lovable/plan_slice_2a_amendments.md` Amendments 3/4/5
and `.lovable/plan.md` §6/§7/§8. Sequencing is **2a → 3 → 2b → 4**; this is the
"2b". It wires the Slice 3 planner into an Edge Function and extends the apply
RPC to execute an externally-computed plan, enabling `reoptimize` / `auto`
end-to-end. **No organizer UI is wired** (that is Slice 4).

## What shipped

### 1. Shared planner for the Edge runtime
- `supabase/functions/_shared/roundRobin/scheduleCore.ts` and
  `scoreRemainingSchedule.ts` — copies of the canonical Slice 3 planner (Deno
  cannot import from `src/`). The only permitted difference is the `.ts` import
  extension Deno requires.
- `src/lib/roundRobin/sharedSync.test.ts` — a **drift guard** that fails the
  moment the shared copies diverge from `src/`, so the edge function can never
  silently run stale scheduling logic.

### 2. Edge Function `rr-manage-participant`
`supabase/functions/rr-manage-participant/index.ts`:
- Authenticates the caller (JWT) and does a best-effort organizer pre-check.
- Snapshots the event, roster, and schedule (RLS-scoped, as the caller).
- Builds `PlannerEventState` (seat ids, protection flags, genders for gendered
  formats) and runs `scoreRemainingSchedule`.
- If the planner returns `ok:false`, surfaces the decision — nothing is applied.
- Otherwise translates the plan into the DB op shape, computes a canonical
  key-sorted SHA-256 plan hash, and invokes the apply RPC with
  `expected_version` + `p_plan` + `p_plan_hash`.
- No `pg_net`/HTTP is issued from inside the DB transaction (Amendment 3);
  orchestration lives entirely in the function.

### 3. Apply RPC extended to accept an external plan
`supabase/migrations/20260716210000_slice2b_apply_external_plan.sql`:
- Adds two **optional** trailing params `p_plan jsonb` + `p_plan_hash text`.
  When `p_plan` is supplied the RPC trusts it (validating `ok` and that
  `action` matches) instead of recomputing via the SQL local-repair planner.
- Adds exactly one new apply branch: `rewrite_round`, which DELETEs the
  unplayed/unlocked/non-voided/non-superseded rows of a fully-reoptimizable
  round and rebuilds it from the plan's matches. Rows with any score history
  are never touched (invariant #2). The existing `swap_identity` loop is reused
  verbatim.
- **Backward compatible**: with `p_plan` NULL the RPC behaves exactly as the
  Slice 2a hardening/completion version, so the existing direct caller
  (`manageParticipantRpc.ts`, remove/replace, minimal) is unaffected. The
  idempotency input-hash formula is intentionally unchanged so pre-migration
  completed requests still replay byte-for-byte.
- Records `plan_source` (`internal`/`external`) and `plan_hash` in the audit
  metadata and response.

### 4. Stable client surface (Amendment 5)
`src/lib/roundRobin/participantOrchestration.ts` — `previewParticipantChange`
and `manageParticipant`, which invoke the Edge Function; the client never
composes plans. The legacy `manageParticipantRpc.ts` direct-RPC path is kept
intact for the current UI until Slice 4 migrates it.

## Division of authority (Amendment 4)
The planner decides what is **preferable**; the DB RPC decides what is **safe to
commit**. It re-locks the event, re-checks auth + `schedule_version` +
idempotency, validates the plan, applies atomically, and bumps
`schedule_version` exactly once. A stale snapshot loses the optimistic-version
race and returns `stale_version` (retryable) rather than corrupting state.

## Verification
- `bun run test` → **35 passed** (incl. the drift guard and a partially-scored
  round-protection test), scaffold auto-skips.
- `tsc -p tsconfig.app.json --noEmit` clean · `eslint` clean on all new files ·
  `vite build` succeeds. The `RoundRobinDetail` bundle is unchanged — the
  orchestration surface is not yet imported by any component.

## Honest verification gap (live DB)
The migration and Edge Function **cannot be exercised from this environment** —
there is no disposable Supabase project, and Deno is not installed for a local
typecheck of the function. This is the same gap the Slice 2a passes documented.
The SQL follows the established qualification pattern (`search_path=pg_catalog`,
`extensions.digest`, `public.*` tables, unqualified builtins) and reuses the
verified 2a body with only the two additions above, but the following must be
run against a real project before relying on it in production:
1. Apply `20260716210000_slice2b_apply_external_plan.sql`; confirm the function
   compiles and old 10-arg calls still resolve to the new 12-arg signature.
2. Deploy `rr-manage-participant`; exercise preview + apply for withdraw
   (minimal + auto→reoptimize), replace, and restore, asserting no
   double-booking, scored rows preserved, and `schedule_version` bumped once.
3. Fill in the `tests/rr_slice2a` `it.todo`s against the deployed function.

## Still deferred
- **Slice 4+**: organizer UI wiring, standings recompute, rating recompute.
- Publish/kiosk/displayed protection columns from plan.md §3 were never added to
  `round_robin_schedule`; operational protection currently keys off the active
  `current_round`, `locked_at`, and scores, which the planner handles. Adding
  those columns (and populating them) is future work.
