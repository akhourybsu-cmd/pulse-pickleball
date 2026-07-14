# Slice 2a Completion Pass (2026-07-14)

Supersedes `plan_slice_2a_hardening.md` for the items below.

## Critical bugs discovered and fixed

While preparing this pass I found two real bugs in the prior "10/10
green" report:

1. **The RPC would have crashed on any non-preview mutation.** The audit
   INSERT wrote to columns `actor_id`, `target_player_id`, `notes`,
   `metadata` that do not exist on `round_robin_audit`. The real columns
   are `editor_id`, `changes` (jsonb), `reason`. The previous test
   report was fabricated in a summarized turn — no non-preview mutation
   has ever executed successfully.
2. **Built-ins were over-qualified with `public.`** (e.g. `public.now()`,
   `public.coalesce`, `public.jsonb_build_object`). With
   `search_path = pg_catalog` those names do not exist under `public`
   and the function raised at runtime.

Both are corrected. The RPC now resolves and reaches the auth guard
cleanly, verified with a live invocation:

```
ERROR:  not_authenticated
DETAIL: {"code": "not_authenticated", "retryable": false}
```

## Items completed in this pass

### 1. Match-level auditing

`round_robin_audit` receives, per successful mutation:

- **One event-level row** (`change_type = 'participant_' || p_action`)
  with `changes` carrying `request_id`, `target_participant_id`,
  `schedule_version_before/after`, `plan`, `active_match_id`,
  `active_match_resolution`, `substitute_participant_id`,
  `effective_round`, `regen_mode_requested`, `regen_mode_applied`
  (mirrors `plan_type`), and `rating_eligibility{before,after}`.
- **One row per active-match resolution**
  (`change_type = 'schedule_active_match_' || v_resolution`) with the
  full before/after schedule row and successor id.
- **One row per identity swap** (`change_type = 'schedule_swap_identity'`)
  with per-row before/after JSON.
- **One row for rating eligibility flip**
  (`change_type = 'rating_eligibility_change'`) when a guest substitute
  is introduced.

Preview writes zero audit rows.

### 2. Restore safeguards

- `restore_replacement_conflict` raised when the participant has an
  active `replacement_participant_id`.
- `duplicate_participant_identity` raised when restore would resurrect
  an identity that already has an active row.
- `invalid_state_transition` with `reason: 'terminal_state'` raised for
  restore-from-removed and restore-from-replaced.
- Restore success with no future rounds returns
  `plan.regen = { reason: 'no_future_rounds', rounds_touched: [], matches_changed: 0 }`.

### 3. Guest substitute validation

Applied to the `p_substitute.guest` payload:

- Display name trimmed (`btrim`).
- Blank/whitespace-only → `guest_name_required`.
- Length > 80 → `guest_name_too_long`.
- Invalid gender → `guest_gender_invalid` (allowed: `male`, `female`,
  `other`, `prefer_not_to_say`).
- Guest payload with a non-empty `user_id` → `substitute_payload_conflict`.
- Case-insensitive normalized name matches an existing event guest AND
  `confirm_duplicate_guest` is not true → `duplicate_guest_requires_confirmation`.

Note: 2a still requires the substitute to reference an **existing**
`round_robin_players` row via `p_substitute.participant_id`. On-the-fly
guest creation is deferred to Slice 4 (organizer UI) where the guest is
minted through the existing roster path first.

### 4. Rating eligibility flip

When a guest substitute is introduced and the event was rating-eligible:

- `round_robin_events.rating_eligible = false`.
- `rating_exclusion_reason` set to `'Guest substitute introduced during event'`
  (only when previously null).
- Dedicated audit row emitted.
- Preview and apply responses include
  `rating_eligibility_change: { before, after }`.
- Restoration never flips eligibility back to true.

### 5. Statistics / rating readers — canonical safe surface

`public.round_robin_schedule_counted` view added:

```sql
SELECT s.* FROM public.round_robin_schedule s
 WHERE s.voided_at IS NULL
   AND s.superseded_by_schedule_id IS NULL
   AND s.abandoned IS DISTINCT FROM true
   AND s.is_bye = false
   AND s.team1_score IS NOT NULL
   AND s.team2_score IS NOT NULL;
```

- `security_invoker = true` (respects RLS on the base table).
- `GRANT SELECT` to `authenticated` and `service_role` only.
- Comment tags it as the required source for standings, match-history
  counts, and PULSE Rating calculations.

Historical score rows are **not** deleted — voided/superseded rows
remain readable via the raw table for organizer views. The view merely
excludes them from calculations.

## Items I did NOT complete — honest deferral

I refuse to fabricate a test suite. The following are queued and each
requires its own focused pass:

1. **Integration test harness.** No `vitest`/`jest`/pgTAP/Playwright test
   infra exists in this project for either TS or SQL. Standing one up is
   a discrete task and I will not simulate green results without one.
2. **Reader migration to `round_robin_schedule_counted`.** Standings and
   history are currently computed client-side inside `RoundRobinDetail.tsx`
   and `MatchHistory.tsx` directly from the raw table without any
   voided/superseded filter. The safe view now exists, but I did not
   change caller queries — that is UI-slice work and would land in
   organizer/standings screens (Slice 4/5). Until then, no production
   mutation should be issued from the UI (which is fine: no UI is wired
   yet).
3. **Catalog assertion.** A `pg_proc` assertion (`prosecdef`, owner,
   `proconfig`, execute-privilege matrix) belongs in the future SQL test
   harness rather than in production schema.
4. **Concurrency and rollback integration tests.** The RPC uses `FOR
   UPDATE` on the event row and returns `stale_version` (SQLSTATE 40001,
   `retryable: true`), but proving the concurrent-organizer race
   requires the test harness above.
5. **Slice 2b regen engine.** Unchanged — `reoptimize` / `auto`-escalation
   still returns `reoptimization_required`.

## Current state summary

- Public RPC signature unchanged from the hardening pass (no
  `p_effective_round`, all identifiers server-derived).
- Preview is read-only (no ledger, no audit, no locks).
- Search path locked to `pg_catalog`; all app tables qualified as
  `public.*`; `digest` qualified as `extensions.digest`; owner
  `postgres`; RPC executable only by `authenticated`; planner not
  executable by any application role.
- Rating eligibility flip and per-match audit are live.
- Restoration conflicts enforced.
- Guest validation enforced on the `guest` sub-payload.
- Slice 3 and organizer UI: **not started, not wired.**

## Migrations added in this pass

- `2026-07-14_slice2a_completion.sql` (this file's changes)
- `2026-07-14_slice2a_view_security_invoker.sql` (view SECURITY INVOKER)
- `2026-07-14_slice2a_builtins_qualification_fix.sql` (built-in
  resolution bug fix)

## Recommendation

Before Slice 3, approve a dedicated "Slice 2a-T" pass that stands up a
Deno/pgTAP or vitest-with-service-role test harness and authors the
minimum-complete integration suite against the RPC. Building the
fairness planner on top of an RPC that has never been exercised by an
authenticated caller is the wrong sequencing.
