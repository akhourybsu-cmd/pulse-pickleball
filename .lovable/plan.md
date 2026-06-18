## Goal

Bring the same tabbed picker UX into the live Round Robin settings — specifically the **Player Management** dialog opened from a running event (RoundRobinDetail and VenueRoundRobinDetail). Today both the "Add player" and "Substitute → new player" flows use a single-select `PlayerSelector` combobox, which has the same cramped, search-only feel the wizard had.

## What changes

### 1. New single-select picker

Add a `mode: "single" | "multi"` prop to the existing `PlayerPickerSheet` (or a thin `SinglePlayerPickerSheet` wrapper). Behavior:
- Same Friends · Group · Recent · Search tabs and clean search input.
- Tapping a player in single mode commits immediately (no Done button) and closes the sheet, returning `{ id, name, isGuest }` to the parent.
- `excludePlayerIds` prop hides players already in the event (or the substitute "original").
- Gender filter respects the event's format.

### 2. PlayerManagementDialog rewrite of the two PlayerSelector spots

- **Add player tab**: replace `PlayerSelector` with the picker sheet trigger. Include the **Guest** tab — guests insert into `round_robin_players` with `player_id = null` + `guest_name` (schema already supports this from the wizard work). Show a chip preview of the chosen player before confirm.
- **Substitute → new player**: replace `PlayerSelector` with the picker sheet trigger, **no Guest tab** (substitution writes into `round_robin_schedule.player_id` which requires a real UUID). Show selected name as a chip.
- "Original player" select and "Mark inactive" select stay as-is — they're picking from existing roster, dropdown is fine.

### 3. Thread `groupId` through

- `RoundRobinDetail.tsx` and `VenueRoundRobinDetail.tsx` already load the event row, which has `group_id`. Pass it into `PlayerManagementDialog`, which forwards it to the picker so the **Group** tab appears when the event is linked to a community group.

### 4. Guest add path on `RoundRobinDetail`

- `handleAddPlayer` currently takes a `playerId: string`. Widen to `({ playerId, guestName }: { playerId: string | null; guestName?: string })` and write `player_id` / `guest_name` accordingly when inserting into `round_robin_players`. Schedule regeneration logic stays the same (guest rows just appear in the rotation by name).
- `VenueRoundRobinDetail` mirrors the same change.

## Out of scope

- `EditMatchSheet` (admin tool) keeps `PlayerSelector` for now — different surface, low traffic.
- No changes to substitution or mark-inactive logic itself.
- No changes to the wizard.

## Technical details

- **Edit:** `src/components/round-robin/PlayerPickerSheet.tsx` — add `mode` and `excludePlayerIds` props; in single mode hide multi-select chips and footer, commit on tap.
- **Edit:** `src/components/round-robin/PlayerManagementDialog.tsx` — swap both `PlayerSelector` usages, add `groupId` prop, render selected chip for confirm step.
- **Edit:** `src/pages/RoundRobinDetail.tsx` — pass `event.group_id` to dialog; update `handleAddPlayer` signature + insert payload to support guests.
- **Edit:** `src/pages/venue/VenueRoundRobinDetail.tsx` — same two changes.
- No new tables, no new migrations — `guest_name` already exists on `round_robin_players`.
