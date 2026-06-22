# Match Card Visual Consistency Audit

## Findings

The app currently renders match results through **three different card components**, each with its own data fetch, name-resolution rules, and visual treatment. The same match looks different depending on where you see it, and several edge cases break when viewing another player's history.

### 1. Three competing card components
| Surface | Component | Avatars | Layout |
| --- | --- | --- | --- |
| `/player/matches` (MatchHistory) | `PremiumMatchCard` | Yes | Hero score, accent stripe |
| `/player/dashboard` (PerformanceModule) | `dashboard/MatchCard` | Yes | Compact stacked teams |
| `/player/profile/:id` (ViewProfile) | `profile/RecentMatches` | **No** | Horizontal scroll chips |

Same match, three completely different visuals. Avatars are missing entirely on profile pages.

### 2. "You & Partner" label is hardcoded
`PremiumMatchCard` always renders the label **"You & Partner"** even when `MatchHistory` is viewed with `?player=<otherId>`. Visiting another player's match history shows their matches with "You" — confusing and wrong.

### 3. Win/Loss is computed differently in each surface
- `MatchHistory`: `won = rating_change > 0` — breaks for matches with `rating_change = 0` or `null` (shows as loss even when score is higher).
- `ViewProfile`: `won = my team's score > other team's score` — correct.
- `PerformanceModule/MatchCard`: derives win inline from score — correct.

Result: the same match can render as a loss on `/player/matches` and a win on `/player/profile`.

### 4. Player-name fallback order is inconsistent
- `MatchHistory`: `display_name || full_name || "Unknown"`
- `ViewProfile`: `display_name || first_name+last_name || "Unknown"`
- `PerformanceModule`: `display_name || full_name || first_name+last_name || "Unknown"`

A player whose `display_name` is null but `full_name` is set will show as "Unknown" on `ViewProfile` but correctly on the other two.

### 5. "Unknown" placeholders leak through
When a profile join returns null (deleted user, RLS blocks), `MatchHistory` renders the literal string "Unknown" with a `?` avatar instead of a graceful "Guest" / removed-player treatment. Singles matches (only one opponent) render a second "Unknown" opponent with a placeholder avatar.

### 6. Profile recent-matches card is visually weakest
`RecentMatches` shows only names in tiny text with no avatars, and the W/L dot strip duplicates info already on the card. It is the only surface where you cannot see who played.

---

## Plan

### A. Single shared name + win helper
Create `src/lib/matchDisplay.ts` exporting:
- `resolvePlayerName(profile)` — canonical order: `display_name → full_name → first_name+last_name → "Removed player"` (no more "Unknown").
- `resolvePlayerInitials(name)` — shared 2-char initials.
- `didTeamWin(team, team1Score, team2Score)` — score-based, never rating-based.
- `formatRatingChange(delta)` — shared `+0.12 / −0.08` formatting with the `Math.abs > 0.0001` zero guard.

Refactor `MatchHistory`, `ViewProfile`, and `PerformanceModule` to use these helpers. Removes all three inconsistencies (#3, #4, #5).

### B. Make `PremiumMatchCard` perspective-aware
Add a `perspective: 'self' | 'other'` prop (default `self`). When `other`, the left column label becomes `{playerName} & Partner` instead of "You & Partner". MatchHistory passes `perspective={playerId ? 'other' : 'self'}`. Fixes #2.

### C. Replace `RecentMatches` and `dashboard/MatchCard` with `PremiumMatchCard`
Use `PremiumMatchCard` (with `showVerifyActions={false}`, `perspective="other"` on ViewProfile, `perspective="self"` on Dashboard) as the single visual on all three surfaces.
- `ViewProfile`: render a vertical stack of up to 10 `PremiumMatchCard`s; keep the existing W/L dot strip above as a sparkline summary.
- `PerformanceModule`: same component, grouped by month header as today.
- Delete `src/components/dashboard/MatchCard.tsx` and `src/components/profile/RecentMatches.tsx` (no other callers — verified via the audit grep).

Fixes #1 and #6 in one stroke.

### D. Handle singles + missing partners cleanly
In `PremiumMatchCard`:
- If `partnerName` is empty/"Removed player", render only the player's avatar and label the column "Solo" (already partly implemented — extend to opponent side).
- If `opponent2Name` is empty, render one opponent avatar and `{opponent1Name}` only (no "· Unknown").

### E. Data-fetch parity
Update `ViewProfile`'s match query to also select `avatar_url`, `full_name` and `rating_change`, matching the shape PremiumMatchCard expects. Keep the existing 10-match limit.

### Out of scope
- No DB schema changes.
- No changes to RR group rendering (`RoundRobinMatchGroup` already uses `PremiumMatchCard`).
- No changes to pending-match flow, verification logic, or routes.
- No redesign of `PremiumMatchCard`'s visuals beyond the `perspective` label swap and singles cleanup.

### Files touched
- new: `src/lib/matchDisplay.ts`
- edit: `src/components/matches/PremiumMatchCard.tsx`
- edit: `src/pages/MatchHistory.tsx`
- edit: `src/pages/ViewProfile.tsx`
- edit: `src/components/dashboard/PerformanceModule.tsx`
- delete: `src/components/dashboard/MatchCard.tsx`
- delete: `src/components/profile/RecentMatches.tsx`
