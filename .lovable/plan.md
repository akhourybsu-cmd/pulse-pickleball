## What Dhruv is seeing and why

In Dhruv's screenshot, every match card shows **YOU / Solo** on the left and **RP / Removed player** on the right. That fallback string only appears in one place — `src/lib/matchDisplay.ts:27`:

```
if (!profile) return "Removed player";
```

So the profile join is coming back **null** for every other participant on every card.

The reason is a Row-Level Security mismatch we already documented in project memory:

> "profiles table is owner-only SELECT. Public discovery uses profiles_public view."

The match-card queries embed `profiles(full_name, display_name, avatar_url)` directly on the protected `profiles` table. When Dhruv is logged in, RLS only lets him read **his own** profile row, so:

- Dhruv's own slot → has a profile → renders his name + avatar
- Teammate slot → profile join returns null → "Removed player" + "RP"
- Opponent slots → same → "Removed player" + "RP"

The match submitter only sees correct names because, in the submitter's previous flow, their own profile happened to be the only one on the card or because they were inspecting recently while other joins still worked for them — but the structural bug is the same on every screen that joins `profiles` directly.

## The fix

Swap every match-card profile join from the protected `profiles` table to the `profiles_public` view (which already has the right columns and is RLS-allowed for any signed-in user). The foreign key `match_participants_player_id_fkey` is already wired through to `profiles_public` in the generated types, so PostgREST can resolve the embed.

### Files to change (frontend only, no schema changes)

1. **`src/pages/MatchHistory.tsx`** — two embedded queries (lines ~232 and ~398) that fetch participant profiles for the verified history list and the pending list. Replace `profiles(full_name, display_name, avatar_url)` with `profiles_public!match_participants_player_id_fkey(full_name, display_name, avatar_url)`.

2. **`src/pages/PendingMatches.tsx`** — line ~91 join `profiles(id, display_name, full_name, first_name, last_name, avatar_url)` → switch to `profiles_public!match_participants_player_id_fkey(...)`.

3. **`src/components/dashboard/PerformanceModule.tsx`** — line ~97 `player:profiles!match_participants_player_id_fkey(...)` → switch the relation to `player:profiles_public!match_participants_player_id_fkey(...)`. (Recent matches on the player dashboard show the same "Removed player" bug otherwise.)

4. **`src/components/dashboard/MatchVerificationDialog.tsx`** — line ~97 `profile:profiles(full_name, display_name)` inside the participant subselect. Switch to `profile:profiles_public!match_participants_player_id_fkey(full_name, display_name)` so the verify dialog shows real names instead of "Removed player".

Out of scope: admin-only screens (`AdminMatches.tsx`, `EditMatchSheet.tsx`) and tournament admin panels keep using `profiles` directly — admins have broader read access and the user's complaint is specifically about player-facing match cards.

### How we verify the fix

- Sign in as a non-submitter player on a match → match card on `/player/matches`, `/player/dashboard` Recent Matches, and the Verify dialog all show the real teammate + opponent names and avatars instead of "Removed player" / "RP".
- The submitter's view is unchanged (their own profile slot already resolved correctly through both paths).

### Why this is safe

`profiles_public` is the canonical "public-facing" view of profile data already used by venue discovery, view-profile, edit-match sheet, and many other relations in the generated types — adopting it for match cards just lines this surface up with the rest of the app and the policy in project memory.
