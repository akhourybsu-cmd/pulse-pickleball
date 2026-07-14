# Round Robin Withdrawal & Substitution Hardening

This is a large, multi-phase engineering pass. Before I start writing code and migrations, I want to confirm scope, sequencing, and a few key policy decisions with you — because several phases require *product decisions* (not just engineering) that will lock in behavior across the whole system.

## Scope of the audit

I will trace and touch the following surfaces:

- Tables: `round_robin_events`, `round_robin_players`, `round_robin_schedule`, `round_robin_audit`, `guest_players`, `guest_match_players`, `matches`, `match_participants`, `match_approvals`.
- Scheduler / fairness: `src/lib/roundRobinScheduler.ts`, `src/lib/roundRobinFairness.ts`, `src/lib/roundRobin/*`.
- UI: `PlayerManagementDialog`, `RegistrationManagement`, `ScheduleEditorDialog`, `HostControlsMenu`, `PlayerRoundRobinView`, kiosk pages, `VenueRoundRobinDetail`, `RoundRobinDetail`.
- Hooks/state: `useVenueRoundRobins`, realtime subscriptions on schedule/players.
- Rating eligibility, guest logic, stats/standings, event completion.

## Proposed work (grouped so we can ship in reviewable slices)

### Slice 1 — Data model & audit trail (migration)
- Add participant status enum: `active | withdrawn | injured | removed | replaced`.
- Add columns to `round_robin_players`: `status`, `withdrawn_at`, `withdrawal_reason`, `effective_round`, `replacement_participant_id`, `replaced_participant_id`, `updated_by`.
- Add `schedule_version` to `round_robin_events` for optimistic concurrency.
- Add match state columns if missing: `locked_at`, `abandoned`, `abandoned_reason`.
- Extend `round_robin_audit` (or reuse) to record every status change with actor, reason, effective round/match, and diff of affected future matches.
- Backfill: all existing players → `active`.
- GRANTs + RLS updated to match.

### Slice 2 — Atomic server-side operation
- Postgres function `rr_withdraw_or_replace_player(event_id, player_id, action, reason, substitute_id?, active_match_policy, expected_version)` that:
  1. Locks the event row.
  2. Verifies `schedule_version` matches (rejects stale organizer clients).
  3. Updates participant status.
  4. Applies active-match policy (see decision 1 below).
  5. Rewrites only unlocked future schedule rows.
  6. Inserts audit rows.
  7. Bumps `schedule_version`.
  8. Returns a structured diff (rounds changed, matches changed, rating-eligibility change).
- All UI paths funnel through this RPC; no client-side multi-step mutations.

### Slice 3 — Fairness engine refactor
- Extract a pure `scoreRemainingSchedule(state)` function driven by the priorities in your Phase 6 (games variance, bye variance, consecutive byes, partner/opponent repeats, court balance, disruption).
- Regeneration reuses completed match history from `initializePlayerStats` and only proposes future rounds.
- Preserve existing round count where feasible; expose when perfect fairness is impossible.

### Slice 4 — Organizer UX (minimal, targeted)
- Single "Manage player" sheet with actions: Withdraw / Mark injured / Remove / Replace with substitute.
- Confirmation preview: completed matches count, active match presence, # future matches affected, rounds affected, rating-eligibility delta, substitute identity.
- Post-action toast + audit entry visible in `AuditHistoryDialog`.
- Double-submit guard, disabled while pending, refetch on realtime `schedule_version` bump.
- No broad visual redesign.

### Slice 5 — Stats / standings / ratings
- Standings query filters scheduled participation by `status`, but retains historical rows for withdrawn players who completed matches (with a "Withdrawn" badge).
- Substitute rendered as separate leaderboard entry.
- Rating eligibility recomputed on every status change; guest substitute flips event to ineligible with explicit confirmation.
- Completed matches never mutated; retirement/forfeit only recorded when the organizer explicitly picks that active-match resolution.

### Slice 6 — Tests
- Unit: fairness scorer, participant state machine, substitute stats isolation, rating eligibility.
- Integration: RPC atomicity, concurrent-organizer conflict via `schedule_version`, idempotency.
- Invariants asserted: completed matches immutable, no withdrawn player in future matches, no duplicate court/round assignment, substitute inherits zero history.

### Slice 7 — Cleanup & report
- Remove duplicated removal logic (there are currently at least two paths — `PlayerManagementDialog` and `RegistrationManagement`).
- Deliver the Phase 12 report.

## Decisions I need from you before starting

1. **Active-match policy menu.** For "player removed while their match is live," which of these should PULSE offer? (I'll only implement what you pick — no invented forfeit scores.)
   - a) Finish & record as played (partner plays it out — only viable if 3 remain? usually not)
   - b) Mark match abandoned / void (no result recorded)
   - c) Restart match with substitute (original match archived as abandoned)
   - d) Record retirement/forfeit — **only if you confirm the score rule** (e.g., 11-0 to opponents, or "no score, W/L only")
   
   My default recommendation: **b + c**, and **d only** if you give me the exact forfeit score rule.

2. **Withdrawn player in standings.** Show them with completed results and a "Withdrawn" tag (my recommendation), or hide entirely from standings once withdrawn?

3. **Guest substitute → rating eligibility.** Confirm current rule: any guest participant in *any* match makes the whole event rating-ineligible? Or only affects the substitute's own matches going forward?

4. **Schedule regeneration aggressiveness.** When a player is removed, should the engine:
   - a) Minimally patch (only swap the withdrawn player out of future matches, keep everything else) — least disruption, may hurt fairness.
   - b) Fully re-optimize remaining rounds — best fairness, more churn for players who already saw their upcoming matches.
   - c) Organizer chooses per action.
   
   My recommendation: **c**, defaulting to (a).

5. **Restore withdrawn player.** Should reversal be supported (before event completion), or is withdrawal terminal?

Once you answer these, I'll execute the slices in order, migration first, and report back after each slice so you can review before the next one lands. Estimated: 1 migration, ~1 RPC, ~8–12 file edits, ~6–10 new/updated tests.