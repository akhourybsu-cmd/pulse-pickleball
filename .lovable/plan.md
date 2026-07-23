# Restore team-format ("Basic League" / doubles) league support

## Problem
`CreateLeagueDialog` still offers "Basic League" (leagueType `doubles`) and `TeamsTab` is fully wired for teams, but the match editor and standings paths were switched to individual-only. Result: organizers set up teams but can't schedule "Team A vs Team B", legacy team-only matches disappear from standings, and player pages hide teammates.

## Scope of fix
Reintroduce team-aware behavior gated on `league.type === "doubles"` (or presence of teams in the season) so ladder/individual leagues stay unchanged.

### 1. `src/components/admin/leagues/MatchesTab.tsx`
- In `MatchEditor`, when the league is doubles: render Team A / Team B `<Select>`s (from `teams` prop) alongside or in place of the four player pickers.
- Add validation `team_a_id !== team_b_id` when both are set.
- Save payload: include `team_a_id` / `team_b_id` instead of hard-coding null when in team mode.
- Match list rendering (line ~199-206) already prefers team names when present — verify it still works after payload restore.

### 2. `src/components/admin/leagues/StandingsTab.tsx` & `src/pages/player/PlayerLeagueDetail.tsx`
- Branch on `league.type`: use `computeTeamStandings` for doubles leagues, `computePlayerStandings` otherwise.
- `StandingsTable` needs to accept team rows (may already — verify).

### 3. `src/lib/leagues/standings.ts`
- Confirm `computeTeamStandings` still exists and handles matches with only `team_a_id/team_b_id` populated. If removed in the same refactor, re-add it.

### 4. `src/pages/player/PlayerLeagueDetail.tsx`
- Restore the "Team roster / teammates" section for doubles leagues (fetch `league_team_members` for the viewer's team in the active season).

### 5. Optional guard
- If we instead choose to deprecate team leagues, remove the "Basic League" option from `CreateLeagueDialog` and hide `TeamsTab`. Decide with user before implementing.

## Verification
- Create a doubles league → add two teams → schedule a match → both team selects work, save persists team IDs, card shows team names.
- Enter a score → StandingsTab shows a team leaderboard.
- Player who is on a team sees their teammates on `PlayerLeagueDetail`.
- Individual/ladder leagues continue to render player pickers and player standings.
