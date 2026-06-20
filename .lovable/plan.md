## Goal
Fix the Add Player feature in the Round Robin organizer's "Manage Players" dialog so a host can pick multiple players in one shot and the **Add Player** button actually submits them.

## Root cause
In `src/components/round-robin/PlayerManagementDialog.tsx`, the Add Player footer button is wired to the wrong state:

```tsx
<Button onClick={handleAddPlayer} disabled={!selectedPlayer || loading} ...>
```

`selectedPlayer` belongs to the *Remove* flow. The Add flow stores its pick in `addPick`, so the button stays permanently disabled even after the host selects someone in the picker sheet. That's why "press add to add them" does nothing.

Additionally, the picker is forced to `mode="single"`, so the host can only pick one person at a time.

## Changes

### 1. `src/components/round-robin/PlayerManagementDialog.tsx`
- Replace single-pick state `addPick: PickerPlayer | null` with multi-pick state `addPicks: PickerPlayer[]`.
- Switch `PlayerPickerSheet` to `mode="multi"`, `allowGuest`, `selectedPlayers={addPicks}`, `onPlayersChange={setAddPicks}`.
- Update the trigger button content:
  - When empty: prompt "Choose players from friends, group, recent, search, or guest".
  - When 1 pick: show that player's avatar + name (existing single-pick visual).
  - When 2+ picks: show stacked avatars + "N players selected".
- Rewrite `handleAddPlayer` to loop over `addPicks` and `await onAddPlayer({ playerId, guestName })` for each (sequential so audit/order is stable). Reset `addPicks` and `mode` on success.
- Fix the footer Add button: `disabled={addPicks.length === 0 || loading}` and label `"Add Player"` / `"Add N Players"` (singular/plural). Loading label `"Adding…"`.
- Clear `addPicks` in the Back and Cancel/close handlers.

### 2. `src/pages/RoundRobinDetail.tsx` — `handleAddPlayer`
Current handler regenerates the schedule on every call. When the dialog now loops over N picks, that would regenerate N times. Keep `onAddPlayer` per-player (clean contract, matches venue page caller too), but make the regenerate cheaper by:
- Leaving `handleAddPlayer` itself unchanged in behavior (insert + audit + regenerate). The dialog already awaits each call sequentially, so correctness is fine; the extra regenerates are acceptable for the typical "add 2–4 late arrivals" case and avoid touching the venue page.

No DB / RLS / edge function changes. No changes to the picker component, the regenerate logic, or the Remove/Substitute flows.

## Verification
- Open a round robin you organize → Manage Players → Add Player.
- Pick 2–3 players in the sheet, confirm picks render in the trigger, and confirm the **Add Player** button enables.
- Press it → toast(s) appear, dialog returns to the menu, new players appear in the Active roster, and the schedule from the current round shows the new players.
- Picking a single player still works (button label reads "Add Player").
- Picking zero keeps the button disabled.
