# Auto-Adjust Round Count When Roster Changes

## Problem

`games_per_player` is the host's source of truth, but `num_rounds` is only recalculated when courts or games-per-player change — never when players are added or removed. So a 4-round, 8-player event that drops to 6 players keeps 4 rounds, leaving players short of their target games.

Today `suggestRounds(players, courts, gpp)` already exists in `src/lib/roundRobinFairness.ts` and is used by court/games-per-player handlers and the Edit Event dialog. The roster handlers in `src/pages/RoundRobinDetail.tsx` (`handleAddPlayer`, `handleMarkInactive`, substitute flow) just call `regenerateScheduleFromRound`, which forwards the stale `event.num_rounds` straight to the edge function.

## Fix

Make `regenerateScheduleFromRound` the single chokepoint that rederives rounds from the current active roster every time the schedule is rebuilt.

### `src/pages/RoundRobinDetail.tsx` — `regenerateScheduleFromRound`
1. After the active-players check, compute:
   - `desiredRounds = suggestRounds(activePlayers.length, event.num_courts, event.games_per_player || 3)`
   - `completedRoundsCount` = highest `round_no` in `round_robin_schedule` for this event where any score is set (so we never shrink below already-played rounds)
   - `targetRounds = Math.max(desiredRounds, completedRoundsCount, fromRound - 1)`
2. If `targetRounds !== event.num_rounds`, update the `round_robin_events` row (`num_rounds: targetRounds`) and write a `round_robin_audit` entry with `change_type: "rounds_auto_adjusted"` and a reason explaining it was driven by the roster change (include before/after counts and player count).
3. Use `targetRounds` (not `event.num_rounds`) in the `generate-round-robin-schedule` invoke body.
4. `fetchEventDetails()` already runs at the end, so local state refreshes.

### Light UX touch
- In `handleAddPlayer` / `handleMarkInactive` / substitute success toasts, when rounds changed, append "· Schedule now N rounds to keep G games/player." Pull the new value from the refreshed event.
- No other call sites need to change: court and games-per-player handlers already call `suggestRounds` themselves, and the Edit Event dialog still drives manual edits.

### Out of scope
- No schema, RLS, or edge-function changes.
- No change to the fairness algorithm, court count, or `games_per_player` semantics.
- Wizard creation flow untouched — it already derives rounds from the configured roster size.

## Technical notes

- `suggestRounds` formula (already implemented): `ceil(desiredGamesPerPlayer × players / (4 × min(courts, floor(players / 4))))`. With 6 players, 2 courts, 4 games/player it returns 6 rounds (vs. the stale 4).
- The "never shrink below completed" guard handles mid-event removals where some rounds are already scored.
- Because `regenerateScheduleFromRound` is the single helper used by every roster mutation (add, remove, substitute, reactivate), one edit covers all entry points.
