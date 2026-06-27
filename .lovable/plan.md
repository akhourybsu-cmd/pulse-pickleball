## Enable Guest Scheduling for Round Robins

Lift the "guests block schedule generation" gate by teaching every layer of the schedule (DB, generator, scoring, display) to carry guest IDs alongside profile IDs.

### Why it's currently blocked

`round_robin_schedule.{a1,a2,b1,b2}_player_id` are FKs to `profiles(id)`, so guest UUIDs can't be inserted. `submit_rr_match_score` and `match_participants` also assume profile IDs (though `match_participants` already has a `guest_player_id` column wired to a different `guest_match_players` table). Result: the wizard lets organizers add guests, but `RoundRobinDetail` toasts "Guest players can't be included in generated schedules yet" and bails.

### Approach

Add parallel `*_guest_id` columns to the schedule and let the generator treat each seat as either a registered player or a guest. Existing rows are unaffected (the new columns are nullable).

### Phase 1 — Database migration

- Add `a1_guest_id`, `a2_guest_id`, `b1_guest_id`, `b2_guest_id` (uuid, nullable, FK → `guest_players(id) ON DELETE SET NULL`) to `round_robin_schedule`.
- Add a CHECK per seat: exactly one of `aN_player_id` / `aN_guest_id` is set when not a bye.
- Update `submit_rr_match_score`:
  - Validate seats by `(player_id IS NOT NULL OR guest_id IS NOT NULL)` instead of player-only.
  - When inserting into `match_participants`, write `guest_player_id` when the seat is a guest. We'll FK that column to **`guest_players`** instead of the legacy `guest_match_players` table (drop + recreate the FK; column already nullable). The existing `participant_has_player` CHECK still holds.
  - Build `verified_by` only from real player UUIDs (skip guests).
  - Skip rating recalculation when the event has `allow_guests = true` (already enforced client-side; keep server-side guard).

### Phase 2 — Edge function (`generate-round-robin-schedule`)

- Accept a new `participants: Array<{ player_id?: string; guest_id?: string }>` payload. Keep `player_ids` for back-compat (treated as all-profile).
- Internally key everything off a synthetic seat id (e.g. `p:<uuid>` / `g:<uuid>`); existing fairness/penalty logic is unchanged.
- When writing rows, split the synthetic id back into `aN_player_id` vs `aN_guest_id`.
- For `mixed`/`male`/`female` formats, guests have no gender record → exclude them from gender-gated rounds and surface a warning. Open format is the supported path for guests.

### Phase 3 — Client wiring

- `RoundRobinDetail.handleGenerateSchedule` / `handleRegenerateFromRound`: remove the guest-bail toasts; build the new `participants` array from `activePlayers` (use `player_id` or `guest_player_id`).
- Schedule fetch: also select `*_guest_id` and join `guest_players` for each seat alongside the existing `profiles_public` joins.
- Display helpers (`getDisplayName`, standings map, lineup rendering) in:
  - `src/pages/RoundRobinDetail.tsx`
  - `src/pages/RoundRobinKiosk.tsx`
  - `src/pages/venue/VenueRoundRobinDetail.tsx`
  - `src/pages/venue/VenueRoundRobinKiosk.tsx`
  - `src/components/round-robin/PlayerRoundRobinView.tsx`
  
  Fall back to `guest_players.display_name + " (Guest)"` when the player slot is a guest.

### Phase 4 — Copy & UX

- `PlayersStep.tsx`: replace "You'll need to swap guests for registered players before generating a schedule" with "Guests are scheduled like everyone else but won't affect PULSE Ratings."
- `RoundRobinDetail` rating-eligibility hero: keep the existing "Not Rating Eligible" badge when `allow_guests`.

### What stays out

- No changes to `guest_match_players` (legacy quick-add casual-match guests).
- No changes to the matches → ratings pipeline beyond the existing `allow_guests` skip.
- Tournament brackets are untouched.

### Files touched

- `supabase/migrations/<new>.sql`
- `supabase/functions/generate-round-robin-schedule/index.ts`
- `src/pages/RoundRobinDetail.tsx`
- `src/pages/RoundRobinKiosk.tsx`
- `src/pages/venue/VenueRoundRobinDetail.tsx`
- `src/pages/venue/VenueRoundRobinKiosk.tsx`
- `src/components/round-robin/PlayerRoundRobinView.tsx`
- `src/components/round-robin/wizard/steps/PlayersStep.tsx`
