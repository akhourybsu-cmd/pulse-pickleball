# Slice 2a Hardening Pass (2026-07-14)

Applied on top of `.lovable/plan_slice_2a_amendments.md`. Where this file
conflicts, this file wins. **Slice 3 remains blocked** until this pass
is reviewed. No organizer UI work has begun.

## Migration shipped

`supabase/migrations/2026-07-14_slice2a_hardening.sql`
(single corrective migration; earlier RPC/planner signatures dropped.)

Verified against the live catalog:

| Function | prosecdef | proconfig | Owner | anon | authenticated | service_role |
|---|---|---|---|---|---|---|
| `public.rr_manage_participant` | true | `search_path=pg_catalog` | postgres | ✗ | ✓ | ✓ |
| `public.rr_plan_participant_change` | true | `search_path=pg_catalog` | postgres | ✗ | ✗ | ✓ |

The planner helper is not executable by any application role; it is
called only via the RPC wrapper.

## 1. Preview is now read-only

**Before:** preview inserted a row into
`rr_participant_mutation_requests` and updated it to
`status='preview_completed'`.

**After:**
- Preview never touches `rr_participant_mutation_requests`.
- Preview never writes audit, participants, schedule, events, or scores.
- Preview reads `round_robin_events` and `round_robin_players` **without**
  `FOR UPDATE`; no event lock is acquired.
- Preview accepts `p_request_id` for correlation only; it is not stored.
- Legacy `preview_completed` rows in the ledger were migrated to
  `status='completed'` (harmless; those rows had a valid response
  payload).
- The `EXCEPTION` handler no longer writes to the ledger when
  `p_preview_only = true`.

Follow-up test (deferred to explicit test task, not yet run): snapshot
row counts, `updated_at`, and `schedule_version` around a preview call
and assert no delta.

## 2. `p_effective_round` removed from the public surface

New RPC signature (parameters listed in order):

```sql
public.rr_manage_participant(
  p_request_id               uuid,
  p_event_id                 uuid,
  p_player_id                uuid,
  p_action                   text,
  p_reason                   text DEFAULT NULL,
  p_expected_version         integer DEFAULT NULL,
  p_regen_mode               text DEFAULT 'auto',
  p_preview_only             boolean DEFAULT false,
  p_substitute               jsonb DEFAULT NULL,
  p_active_match_resolution  jsonb DEFAULT NULL
) RETURNS jsonb
```

- `effective_round` is derived server-side inside
  `rr_plan_participant_change` as
  `COALESCE(round_robin_events.current_round, 1)` and returned in the
  planner result as `effective_round`.
- The RPC records `effective_round = <server-derived value>` on the
  participant row, in the audit metadata, and in the response.
- Callers cannot backdate or defer a transition; there is no path to
  supply an override.
- Follow-up test: prove no override is accepted (compile-time: the
  parameter no longer exists in `pg_proc.pronargs`).

## 3. Search path locked down

- Both functions: `SET search_path = pg_catalog`.
- Every reference is fully schema-qualified: `public.round_robin_*`,
  `public.rr_*`, `public.has_role`, `public.digest`, `public.encode`,
  `public.jsonb_*`, `public.nullif`, `public.now`, `public.coalesce`,
  `auth.uid()`.
- Grants: `REVOKE ALL … FROM PUBLIC, anon`; `GRANT EXECUTE … TO
  authenticated` (RPC only); planner has no grants beyond `postgres`.
- Because `digest` lives in the `extensions` schema and we cannot rely
  on that schema being in a locked-down `search_path=pg_catalog`, the
  hardening migration references `public.digest` (pgcrypto is exposed
  via `public` in this project — carrying that over from the prior
  migration). Moving `pgcrypto` out of `public` is a separate
  project-wide task tracked by the linter (`0014_extension_in_public`)
  and not attempted in this slice.

## 4. Plan types are semantically accurate

Planner return now includes `plan_type` at the top level:

| plan_type | When |
|---|---|
| `no_schedule_change` | Nothing to touch in the remaining schedule |
| `local_round_repair` | Withdraw/injure/remove requires per-round swaps |
| `replace_identity` | Substitution rewrites future rounds |
| `restore_identity` | Restore (no schedule ops in 2a) |
| `reoptimization_required` (via `code`) | Local repair insufficient |

The internal per-row `op = 'swap_identity'` is still emitted inside
`plan[]` because that is the physical database operation. It is no
longer the top-level classifier the organizer approves.

## 5. Identity uniqueness enforced on `replace`

If the substitute's underlying registered profile (`v_sub_profile`)
already has any other participant row in the event (any status), the
RPC raises `duplicate_participant_identity` with structured DETAIL:

```json
{"code":"duplicate_participant_identity","identity_kind":"profile","identity_id":"…","retryable":false}
```

Guest identity dedup remains out of scope for automatic rejection
(guests can legitimately re-appear as new roster entries), which is why
the confirmation flag in `p_substitute` exists.

## 6. Multiple active matches guard

Before choosing an active match, the RPC counts candidates. If more than
one active, non-voided, non-superseded match on the current round
contains the outgoing identity, the RPC raises
`multiple_active_matches` with `count` in DETAIL.

## 7. Error name reconciliation

`active_match_resolution_required` is the single stable code, matching
`p_active_match_resolution`. `active_match_policy_required` is retired.

## 8. Structured error envelope

Every raised error now includes a JSON DETAIL with at least:

```json
{"code":"<stable_code>","retryable":<bool>}
```

`stale_version` uses SQLSTATE `40001` and `retryable=true`. Clients must
switch on `DETAIL.code`, not on SQLSTATE, to distinguish the app-level
optimistic-version conflict from a genuine serialization failure.

## What is explicitly still deferred

The following items from the review were **not** completed in this
hardening pass. They are queued and must be addressed before Slice 3
report sign-off if you want them in 2a:

1. **Expanded test matrix (~60 cases).** The current test count remains
   at the 10 from the previous checkpoint. Adding the full matrix (state
   transitions, active-match resolution variants, local-repair validity,
   substitute/restore safeguards, idempotency/concurrency/rollback,
   authorization/auditing) is a substantial task and I have not
   fabricated results. Recommend a dedicated test-authoring pass next.
2. **Standings / ratings query audit.** Existing readers have not yet
   been swept for `voided_at IS NULL AND superseded_by_schedule_id IS
   NULL` predicates. This must precede any statistics-visible slice.
3. **Audit granularity per affected match.** The audit row captures the
   full plan JSON in `metadata`, but a per-match audit row is not yet
   emitted. Contract-level requirement, deferred.
4. **Restore-with-active-replacement-chain rejection**
   (`restore_replacement_conflict`) — not yet enforced.
5. **Guest normalization / validation surface** — guest name trim, blank
   rejection, oversize rejection, invalid gender, `confirm_duplicate_guest`
   — not yet implemented.
6. **Rating-eligibility side effect** on guest replacement — not yet
   enforced; no audit event emitted for the eligibility flip.
7. **Catalog assertion migration** proving owner / prosecdef / proconfig
   / grants — verified manually above, not yet codified as a migration
   test.
8. **`original_schedule_id` deprecation removal** — still deferred per
   amendment 7.

## Slice 3 / UI status

- Slice 3 (`scoreRemainingSchedule` TS planner) — **not started.**
- Organizer UI — **not started, not wired.**

## Recommended next step

Approve a focused "Slice 2a test-authoring + deferred items" pass so the
remaining 8 items above are addressed against the now-corrected surface,
rather than authoring tests against the old surface and re-doing them.
