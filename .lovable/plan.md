## Goal

Replace the cramped search-only "Add Players" UI in the Round Robin wizard with a **picker sheet** that lets organizers grab people from sources they already trust — friends, group members, recent co-players — and only falls back to typed search when needed. Plus a way to add guests who aren't on the app.

## New player picker sheet

Replace `MultiPlayerCombobox` (inside `PlayersStep.tsx`) with a full-height bottom sheet, `PlayerPickerSheet.tsx`. Trigger button shows `+ Add Players` and the running count of selected players as chips below.

Inside the sheet, a sticky header with:
- Selected players as removable chips (wraps, scrollable)
- A clean search input (full-width, larger touch target, proper contrast — fixes the "hard to read text window")
- Tabs: **Friends · Group · Recent · Search · Guest**

### Tab contents

1. **Friends** — `useFriends()` accepted friends. Avatar + name + rating. Tap to toggle. "Add all" action at top when list ≤ remaining slots.
2. **Group** — only visible when the RR is linked to a group (`group_id` from wizard state). Lists `group_members` for that group via `useGroupMembers`. Same toggle pattern, plus "Add all members".
3. **Recent** — players the organizer played with in the last ~10 round-robins / matches. Single batched query against `round_robin_players` joined to events they organized, dedup + sort by most recent.
4. **Search** — current behavior, but with the bigger input and avatar-rich list rows. Only this tab hits the broad `profiles` query.
5. **Guest** — quick form: name + optional gender (when format requires it). Creates a `{ id: 'guest-<uuid>', full_name, isGuest: true }` entry. Handled downstream the same way placeholder count slots are (no profile lookup required at submit).

Gender filter from the `format` prop applies across all tabs (Friends/Group/Recent are filtered client-side; Search keeps the server filter).

### Selection model

Sheet maintains a local `Set<string>` plus a `guests[]` array, only commits to parent `onPlayersChange` when the user taps **Done (N)** in the sticky footer. Footer also shows minimum-player warning inline.

## Wizard integration

`PlayersStep.tsx`:
- Remove the `MultiPlayerCombobox` block.
- Render a summary card: avatars stack + "X players added" + Edit button that opens `PlayerPickerSheet`.
- Pass through `groupId` (already on wizard state) and `format` for gender filtering.
- Keep the "Or just enter a player count instead" escape hatch.

`WizardContainer.tsx`: extend the player payload to accept guest entries — on submit, guest rows insert into `round_robin_players` with `player_id = null` and a `guest_name` column.

## Technical details

- **New file:** `src/components/round-robin/PlayerPickerSheet.tsx` (uses shadcn `Sheet`, `Tabs`, `Command` only inside the Search tab).
- **New hook:** `src/hooks/useRecentCoPlayers.ts` — single batched query, React Query cached.
- **Edit:** `src/components/round-robin/wizard/steps/PlayersStep.tsx`, `src/components/round-robin/wizard/WizardContainer.tsx`.
- **Schema:** add nullable `guest_name text` to `round_robin_players` (migration), so guests don't require a profile row. RLS unchanged.
- `MultiPlayerCombobox.tsx` stays for other callers; the RR wizard simply stops using it.

## Out of scope

- No changes to the friends/community system itself.
- No SMS/email invites for guests (just local-name placeholders for this RR).
- No changes to the open-registration max-players UI.
