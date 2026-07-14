# Round Robin Participant Management — Slice 2 Contract (v2, revised)

Status: **Awaiting sign-off before implementation.** Supersedes v1 contract.
Scope: server-side RPC + idempotency + shared planner. No UI, no standings, no rating recompute (those are Slices 4/5).

---

## 1. Function surface

```sql
public.rr_manage_participant(
  p_request_id                uuid,          -- REQUIRED, client-generated idempotency key
  p_event_id                  uuid,
  p_player_id                 uuid,          -- round_robin_players.id (the participant row)
  p_action                    text,          -- 'withdraw' | 'injure' | 'remove' | 'replace' | 'restore'
  p_reason                    text,
  p_expected_version          bigint,        -- round_robin_events.schedule_version snapshot
  p_regen_mode                text DEFAULT 'auto',   -- 'minimal' | 'reoptimize' | 'auto'
  p_preview_only              boolean DEFAULT false,
  p_substitute                jsonb DEFAULT NULL,    -- see §4
  p_active_match_resolution   jsonb DEFAULT NULL     -- see §5
) RETURNS jsonb
SECURITY DEFINER
SET search_path = public, pg_catalog
LANGUAGE plpgsql;
```

- Owner: dedicated role `rr_rpc_owner` (not `postgres`, not application user).
- `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon;`
- `GRANT EXECUTE ... TO authenticated;`
- All table refs schema-qualified. All helper functions schema-qualified. Cannot be shadowed via search path.
- `auth.uid()` is validated first; caller-supplied identifiers are never trusted for authorization.

Preview and apply share **one internal planner**: `rr_plan_participant_change(...)` (also `SECURITY DEFINER`, owned by same role, `REVOKE`d from `PUBLIC`/`anon`, called only from the outer RPC — not directly exposed).

---

## 2. Participant state machine

```
active ──withdraw──▶ withdrawn ──restore──▶ active
active ──injure────▶ injured   ──restore──▶ active
active ──remove────▶ removed   (terminal)
active ──replace───▶ replaced  (terminal; substitute row inserted, chain linked)
```

- `restore` is valid ONLY from `withdrawn` or `injured`.
- `removed` and `replaced` are terminal — never re-enter `active`.
- Replacement chain is a DAG: each row may point to one predecessor via `replaced_participant_id` and one successor via `replacement_participant_id`. Cycles are rejected (invariant #10).

`effective_round` semantics (invariant, matches §7):
- Normal transition: `effective_round = first affected unlocked round` (typically `current_active_round + 1`, or `current_active_round` if no active round is in progress).
- `replace` with `restart_with_sub` during an active round: substitute's `effective_round = current_active_round` (substitute is playing in that round).

Response reports both `status_effective_round` and `first_regenerated_round` — they can differ.

---

## 3. Protection levels (replaces v1 "frozen")

**Historically locked — completely immutable.** Any attempt to modify raises `invariant_violation`.
- Completed matches
- Verified / approved matches
- Matches with a submitted valid final score
- Historically abandoned matches
- Superseded historical matches

**Operationally protected — narrow local repair only.** Modified ONLY if leaving unchanged would retain an unavailable player or produce an invalid match. Never broadly re-optimized.
- The active round
- The next published round
- Matches already displayed to players (`displayed_to_players_at IS NOT NULL`)
- Matches currently on kiosk (`kiosk_visible_at IS NOT NULL`)
- Matches prepared for scoring (`prepared_for_scoring_at IS NOT NULL`)

**Reoptimizable.** Later unlocked, unpublished rounds. Fully regeneratable.

New/repurposed schedule columns to support this (added in the Slice 2 migration):
- `published_at timestamptz` — set when a round becomes visible to players
- `displayed_to_players_at timestamptz`
- `kiosk_visible_at timestamptz`
- `prepared_for_scoring_at timestamptz`
- `abandoned boolean NOT NULL DEFAULT false` (existing from Slice 1)
- `superseded_by_schedule_id uuid REFERENCES round_robin_schedule(id)` (directional)
- `supersedes_schedule_id uuid REFERENCES round_robin_schedule(id)` (directional)
- `original_schedule_id` from Slice 1 is **removed** (replaced by the two directional columns above).

Partial unique constraint on `(event_id, round_no, court_no)` — applies **only** to rows that are `NOT abandoned AND superseded_by_schedule_id IS NULL AND is_bye = false AND court_no > 0`.

---

## 4. `p_substitute` payload

```jsonc
{ "kind": "user",  "user_id": "uuid" }
// or
{ "kind": "guest", "display_name": "string", "gender": "male|female|nonbinary|unspecified" }
```

Validation:
- Trim `display_name`; reject empty / whitespace-only; max length 80.
- Gender validated against enum; unknown → `invalid_substitute`.
- `kind='guest'` MUST NOT include `user_id`; `kind='user'` MUST include a valid `user_id`.
- Substitute may NOT be the outgoing participant (`self_substitution`).
- Substitute's underlying identity (user_id for `user`; normalized display_name for `guest`) is checked against ALL existing participant rows in the event (any status). If a `user`-kind substitute's `user_id` already appears anywhere in the event → `invalid_substitute`. A withdrawn/injured player must return via `restore`, not `replace`.
- Guest display-name collision (case-insensitive, trimmed) with any existing participant → `duplicate_guest_confirmation_required` unless request body explicitly sets `"confirm_duplicate_guest": true` inside `p_substitute`.
- Guest substitute sets `rating_eligible = false` on the event (monotonic — cannot re-enable during the event; invariant #13).

---

## 5. `p_active_match_resolution` payload

Required whenever the participant has an active or partially-scored match at the time of the change. Multiple active matches involving the participant → `multiple_active_matches` (invariant).

```jsonc
{
  "match_id": "uuid",
  "policy": "finish_and_record | restart_with_sub | abandon",
  "final_score": null | { /* event-format-specific score payload */ }
}
```

Rules:
- `match_id` MUST reference a schedule row that (a) belongs to `p_event_id`, (b) contains `p_player_id`, (c) is currently `active`/`in_progress`/`partially_scored`. Violations → `active_match_not_found` / `active_match_mismatch`.
- **`finish_and_record`**: valid ONLY if (a) a valid final score already exists on the match, OR (b) `final_score` is supplied and passes event scoring-rule validation atomically. Otherwise → `final_score_required` or `invalid_final_score`. Match is finalized as `completed` inside this transaction. No "leave in progress" behavior.
- **`restart_with_sub`**: valid ONLY when `p_action = 'replace'`; otherwise → `restart_requires_replacement`. The existing match is marked `abandoned = true` and `superseded_by_schedule_id = <new row id>`. A new active schedule row is inserted for the same `(round_no, court_no)` with `supersedes_schedule_id = <old row id>`. Substitute must pass all §4 validation before insertion.
- **`abandon`**: mark `abandoned = true`, `abandoned_reason`, `abandoned_at`. Any partial score history is preserved on the row and its child score-history rows; scores are flagged `voided_at`, `voided_reason` and excluded from standings and ratings. **No score row is deleted or cleared.** (Invariant #2.)

---

## 6. Regeneration modes & fairness guardrails

- **`minimal`** = minimal *valid local repair* of the affected unlocked rounds only. Never creates a 3-player match, never empty seats, never duplicates, never a superseded/abandoned playable row. If no valid local repair exists → `minimal_regen_not_possible`.
- **`reoptimize`** = full re-plan of all reoptimizable rounds (§3), keeping historically-locked rows immutable and operationally-protected rows unchanged wherever they remain valid.
- **`auto`** = try `minimal`; escalate to `reoptimize` if any of the deterministic guardrails below fire, or if `minimal` returns `minimal_regen_not_possible`.

**Deterministic fairness guardrails** (any one triggers escalation under `auto`):
1. Projected final game-count spread > 1
2. Projected final bye-count spread > 1
3. Any avoidable consecutive bye for any player
4. Any partnership count reaching 3 when a lower-repeat arrangement exists
5. Any immediate exact-matchup repeat (same 4 players, same team split) when avoidable
6. Any player receiving materially more/fewer remaining games than peers (defined as the game-spread rule above)
7. Any invalid or under-filled match
8. Any player appearing twice in one round
9. Avoidable loss of court capacity (a court going empty when a valid pairing exists)
10. A protected upcoming round modified more heavily than a full later-round reoptimization would have required

Response always returns `fairness_triggers` (list of rule IDs above that fired) and `fairness` before/candidate/applied metrics (see §8).

Slice 2 ships a small deterministic evaluator embedded in the planner. Slice 3 replaces the internal implementation with the extracted `scoreRemainingSchedule` — **the public RPC contract does not change.**

---

## 7. Transaction sequence (apply path)

1. `SET LOCAL lock_timeout = '3s';` — on timeout → `lock_timeout`.
2. Validate `auth.uid()` present; resolve caller; verify organizer/staff for `p_event_id`. Failure → `not_authorized`.
3. Look up idempotency row for `p_request_id`:
   - Present + `completed` + payload hash matches → return stored response verbatim (no version bump).
   - Present + `completed` + payload hash differs → `idempotency_conflict`.
   - Present + `processing` → `idempotency_conflict` (client is retrying mid-flight; must generate a new request_id).
   - Absent → INSERT with `processing` (unique on `request_id`; race-safe).
4. `SELECT ... FROM round_robin_events WHERE id = p_event_id FOR UPDATE;`
5. If `schedule_version <> p_expected_version` → `stale_version`.
6. `SELECT ... FROM round_robin_players WHERE id = p_player_id AND event_id = p_event_id FOR UPDATE;` (else `participant_not_found` / `participant_event_mismatch`).
7. Validate action against state machine (§2).
8. Detect active-match participation for `p_player_id`. Multiple active → `multiple_active_matches`. Any active → require `p_active_match_resolution` (§5).
9. Validate `p_substitute` (§4) for `replace`. Reject `restart_with_sub` for any action other than `replace`.
10. Call `rr_plan_participant_change(...)` — returns `{ regen_plan, fairness, guardrails_fired, escalated_from }`.
11. If `p_preview_only = true`:
    - Update idempotency row to `preview_completed` (does NOT block future non-preview requests with the same key; preview uses a distinct sub-status so an eventual apply can still run — but a preview stored response is returned to duplicate previews).
    - Return preview response (§8). **No writes to participants, schedule, event, or audit.**
12. Apply (in order):
    - INSERT substitute participant row (if `replace`), link chain, set `effective_round`.
    - UPDATE outgoing participant status, `withdrawn_at`, `withdrawal_reason`, `effective_round`, `updated_by`, `updated_at`.
    - Resolve active match per §5 (finalize / supersede+restart / abandon+void scores).
    - Apply schedule regeneration diff (`UPDATE`/`INSERT`/soft-abandon rows per plan). Never `DELETE` a row that has any score history — mark `abandoned`+`superseded_by_schedule_id`.
    - `INSERT round_robin_audit` rows (one per logical change: status change, active-match resolution, per-round regen summary).
    - `UPDATE round_robin_events SET schedule_version = schedule_version + 1, updated_at = now();`
    - If guest substitute: `UPDATE round_robin_events SET rating_eligible = false` (irreversible for this event; invariant #13).
13. Update idempotency row: `status='completed'`, `response=<jsonb>`, `completed_at=now()`.
14. Return response.

Any failure raises with structured DETAIL (see §9); transaction rolls back; idempotency row rolls back too (it was inserted in the same tx). Invariant #18 and #19 hold naturally.

---

## 8. Response shape

Success (apply):

```jsonc
{
  "ok": true,
  "action": "replace",
  "preview": false,
  "participant": {
    "id": "uuid",
    "status": "replaced",
    "status_effective_round": 4,
    "replacement_participant_id": "uuid"
  },
  "substitute": { "id": "uuid", "kind": "guest", "display_name": "Sub A", "effective_round": 4 },
  "active_match": {
    "match_id": "uuid",
    "resolution": "restart_with_sub",
    "superseded_schedule_id": "uuid",
    "new_schedule_id": "uuid"
  },
  "regen": {
    "mode_requested": "auto",
    "mode_applied": "reoptimize",
    "reason": "guardrails_fired",
    "first_regenerated_round": 4,
    "rounds_touched": [4, 5, 6],
    "matches_changed": 6,
    "matches_preserved": 12,
    "protected_rounds_touched": [4],
    "protected_matches_touched": 1
  },
  "fairness": {
    "before":            { "projected_game_spread": 1, "projected_bye_spread": 1, "partner_repeat_max": 2 },
    "minimal_candidate": { "projected_game_spread": 2, "projected_bye_spread": 1, "partner_repeat_max": 3 },
    "applied":           { "projected_game_spread": 1, "projected_bye_spread": 1, "partner_repeat_max": 2 }
  },
  "fairness_triggers": ["projected_game_spread_exceeds_one", "third_partner_repeat"],
  "rating_eligibility": { "before": true, "after": false, "reason": "guest_substitute" },
  "schedule_version": 42,
  "audit_ids": ["uuid", "uuid", "uuid"],
  "request_id": "uuid"
}
```

Success (preview): identical shape with `"preview": true`, no `audit_ids`, no `schedule_version` bump (returns current value).

Success (restore with no future rounds):

```jsonc
{
  "ok": true, "action": "restore", "preview": false,
  "participant": { "status": "active" },
  "regen": { "rounds_touched": [], "matches_changed": 0, "reason": "no_future_rounds" },
  "schedule_version": 42,
  "request_id": "uuid"
}
```

Error shape (raised via `RAISE EXCEPTION USING DETAIL = jsonb`):

```jsonc
{ "code": "stale_version", "message": "The schedule changed. Refresh and try again.", "retryable": true }
```

Client mapper reads `code` from DETAIL JSON, never parses `message`.

---

## 9. Full error code set

Existing (unchanged): `not_authorized`, `stale_version`, `invalid_action`, `invalid_state_transition`, `lock_timeout`, `invariant_violation`, `event_not_found`.

Added:
- `idempotency_conflict`
- `minimal_regen_not_possible`
- `active_match_not_found`
- `active_match_mismatch`
- `final_score_required`
- `invalid_final_score`
- `restart_requires_replacement`
- `multiple_active_matches`
- `self_substitution`
- `duplicate_guest_confirmation_required`
- `participant_not_found`
- `participant_event_mismatch`
- `invalid_substitute`
- `guest_name_required`
- `restore_replacement_conflict`
- `restore_no_future_rounds` *(returned as success — see §8 — not an error)*

Postgres `lock_not_available` / `55P03` is trapped and mapped to `lock_timeout`.

---

## 10. Invariants (asserted in the RPC and by DB constraints)

1. Completed, verified, approved, abandoned-historical, and superseded-historical matches are immutable.
2. No submitted score record is deleted or cleared by participant management.
3. Every playable doubles match contains exactly 4 non-null participant IDs.
4. All 4 participant IDs in a playable match are distinct.
5. No participant is assigned to multiple courts in the same round.
6. No two active (`abandoned=false AND superseded_by_schedule_id IS NULL AND is_bye=false`) schedule rows share `(event_id, round_no, court_no)` — enforced by partial unique index.
7. No withdrawn / injured / removed / replaced player appears in any future active match after their `effective_round`.
8. Abandoned or superseded matches do not contribute to standings.
9. Abandoned or superseded matches do not contribute to ratings.
10. Replacement chain is acyclic.
11. Substitute identity ≠ outgoing participant identity.
12. Substitute identity has no other participant row in the event.
13. Guest-driven rating ineligibility cannot be reversed within the event.
14. Preview mode performs no persistent writes (asserted by test that snapshots all affected tables before/after).
15. A repeated successful `p_request_id` with matching payload returns the same response with no additional version bump.
16. A repeated `p_request_id` with a different payload returns `idempotency_conflict`.
17. `schedule_version` increments exactly once per successful applied mutation.
18. A failed transaction does not increment `schedule_version`.
19. A failed transaction does not leave an idempotency row marked `completed`.
20. No playable match has an empty seat.
21. No participant row belongs to a different event than the event being modified.

---

## 11. New / changed schema (Slice 2 migration)

### New table

```sql
CREATE TABLE public.rr_participant_mutation_requests (
  request_id       uuid PRIMARY KEY,
  event_id         uuid NOT NULL REFERENCES public.round_robin_events(id) ON DELETE CASCADE,
  actor_user_id    uuid NOT NULL,
  payload_hash     text NOT NULL,        -- sha256 of canonicalized inputs
  status           text NOT NULL CHECK (status IN ('processing','completed','preview_completed','failed')),
  response         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  UNIQUE (event_id, request_id)
);

CREATE INDEX ON public.rr_participant_mutation_requests (event_id, actor_user_id, created_at DESC);

GRANT SELECT ON public.rr_participant_mutation_requests TO authenticated;   -- read own via RLS
GRANT ALL    ON public.rr_participant_mutation_requests TO service_role;

ALTER TABLE public.rr_participant_mutation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "actors read own idempotency rows"
  ON public.rr_participant_mutation_requests FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());
-- writes are performed only by SECURITY DEFINER RPC, no INSERT/UPDATE/DELETE policies for end users.
```

### `round_robin_schedule` — additions

- `published_at timestamptz`
- `displayed_to_players_at timestamptz`
- `kiosk_visible_at timestamptz`
- `prepared_for_scoring_at timestamptz`
- `superseded_by_schedule_id uuid REFERENCES round_robin_schedule(id)`
- `supersedes_schedule_id uuid REFERENCES round_robin_schedule(id)`
- DROP `original_schedule_id` (backfill into `supersedes_schedule_id` first)
- Partial unique index (invariant #6):
  ```sql
  CREATE UNIQUE INDEX round_robin_schedule_active_slot_uniq
    ON public.round_robin_schedule (event_id, round_no, court_no)
    WHERE abandoned = false AND superseded_by_schedule_id IS NULL AND is_bye = false AND court_no > 0;
  ```

### Score history preservation

- `round_robin_schedule.voided_at timestamptz`
- `round_robin_schedule.voided_reason text`
- Any score-child tables get equivalent `voided_at` / `voided_reason` columns rather than DELETE.

### Ownership & grants

- `CREATE ROLE rr_rpc_owner NOINHERIT;`
- Functions `rr_manage_participant`, `rr_plan_participant_change`, plus internal helpers, `OWNED BY rr_rpc_owner`.
- `REVOKE ALL ON FUNCTION public.rr_manage_participant(...) FROM PUBLIC, anon;`
- `GRANT EXECUTE ON FUNCTION public.rr_manage_participant(...) TO authenticated;`
- Planner and helpers are NOT granted to any role — only invoked internally.

---

## 12. What Slice 2 explicitly does NOT do

- No UI (Slice 4).
- No standings recompute or rating recompute (Slice 5) — the RPC only sets `rating_eligible=false` when a guest substitute joins.
- No extraction of `scoreRemainingSchedule` to TypeScript (Slice 3).
- No removal of duplicate removal paths in existing UI (Slice 7).

---

## 13. Test matrix delivered with Slice 2

- Idempotency: same key + same payload → same response, no version bump.
- Idempotency conflict: same key + different payload → `idempotency_conflict`.
- Stale version: concurrent organizers.
- Preview: table snapshots identical before/after.
- Preview + apply share plan: identical `regen` shape for same inputs.
- Withdraw, no substitute, minimal succeeds when valid local repair exists.
- Withdraw, no substitute, minimal fails → `minimal_regen_not_possible`.
- Auto escalation: guardrail-firing scenario returns `mode_applied='reoptimize'` with `fairness_triggers` populated.
- Active-match `finish_and_record` without score → `final_score_required`.
- Active-match `finish_and_record` with invalid score → `invalid_final_score`.
- Active-match `restart_with_sub` on non-replace → `restart_requires_replacement`.
- Active-match `abandon` preserves partial scores as `voided_at`, does not delete any row.
- Restore from `withdrawn` succeeds; from `removed` → `invalid_state_transition`.
- Restore with no future unlocked rounds → success with `reason:"no_future_rounds"`.
- Substitute = self → `self_substitution`.
- Substitute already active → `invalid_substitute`.
- Guest name collision without confirmation → `duplicate_guest_confirmation_required`.
- Rollback: forced exception mid-transaction leaves `schedule_version` unchanged and no `completed` idempotency row.
- Invariant #6 (partial unique) rejects a duplicate active slot.
- Invariant #10 rejects a chain cycle.
- No `DELETE` observed on `round_robin_schedule` rows that have score history.
- No three-player match producible via any exposed action.

---

## Approval requested

Please confirm this v2 contract is exactly what you want before I write the migration and RPC. Specifically:

1. Column names on `round_robin_schedule` — OK with `supersedes_schedule_id` / `superseded_by_schedule_id` and dropping `original_schedule_id` from Slice 1 (backfilled into the new columns)?
2. Idempotency row status set `{processing, completed, preview_completed, failed}` — OK, or would you prefer preview reuse the same `completed` bucket and distinguish via a boolean?
3. `rr_rpc_owner` as a dedicated non-login role for function ownership — OK?
4. Guest confirmation flag lives inside `p_substitute` as `"confirm_duplicate_guest": true` — OK, or would you prefer a separate top-level parameter?

Say "approved as written" (or specify changes) and I'll ship Slice 2 in a single atomic pass and pause with the full report.
