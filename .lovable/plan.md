# Match Card Consistency — Pass 2

Working backwards from `PremiumMatchCard`, I traced every surface that renders live player match data. Most already use `PremiumMatchCard` (MatchHistory verified + pending, Dashboard PerformanceModule, ViewProfile, RoundRobinMatchGroup). Three real inconsistencies remain.

## Findings

### 1. `PendingMatches` page is still a legacy card
`/pending-matches` (`src/pages/PendingMatches.tsx`) renders a three-column "Team 1 / score / Team 2" `Card` with plain text names, an "X/4 Approved" badge, and Approve/Reject buttons. No avatars, no W/L styling, no rating delta, no source/RR badge — visually unrelated to the pending card in `MatchHistory` which already uses `PremiumMatchCard` with `pending` + `onConfirm`.

### 2. RR matches in MatchHistory render without the viewer's avatar
`RoundRobinMatchGroup` forwards `playerName` to `PremiumMatchCard` but never `playerAvatarUrl`. Result: in a round-robin group, the "You" slot is initials-only while singles matches a row above show the avatar. Same player, two looks on the same page.

### 3. Dead/redundant code in `PremiumMatchCard`
`const initials = resolvePlayerInitials;` is a leftover rename. Harmless but invites drift. Remove.

(`DemoPerformanceModule` is intentionally left alone — it renders seeded onboarding-tour data, not live matches, and isn't reached from a real player surface.)

## Plan

### A. Replace the `PendingMatches` body with `PremiumMatchCard`
- Extend the page's fetch to also pull each player's `avatar_url` and the match's `source` / `round_no` / `court_no` so the card has the same data shape as MatchHistory's pending section.
- For each pending match: identify which team the viewer is on, resolve names through `resolvePlayerName`, then render `<PremiumMatchCard pending pendingConfirmedByMe={match.my_approval === true} onConfirm={...} showVerifyActions={false} ratingChange={null} won={didTeamWin(myTeam, t1, t2)} perspective="self" />`.
- Keep the existing Approve action wired to `onConfirm`. Drop the Reject button from the card itself — match it to MatchHistory's pending UX (confirm-only; report/contest stays in the existing report flow). If the user wants reject preserved, surface it via the existing `onReport` slot or a secondary text link below the card.
- Keep page header, empty state, and `fetchPendingMatches` polling intact.

### B. Forward `playerAvatarUrl` through `RoundRobinMatchGroup`
- Add `playerAvatarUrl?: string | null` to the group's props.
- In `MatchHistory`, pass `playerAvatarUrl` into the `<RoundRobinMatchGroup>` call (already resolved as `playerAvatarUrl` in the page).
- Forward it onto every `<PremiumMatchCard>` inside the group.

### C. Tidy `PremiumMatchCard`
- Remove the `const initials = resolvePlayerInitials;` alias and call `resolvePlayerInitials(...)` directly at each usage. No behavior change.

### Out of scope
- No schema changes, no new fetches beyond the two new columns in (A).
- No visual redesign of `PremiumMatchCard`.
- No changes to kiosk/live round-robin boards (`RoundRobinKiosk`, `VenueRoundRobinKiosk`) — those are live-court signage, not historical match cards.
- `DemoPerformanceModule` left as-is (onboarding tour content).

### Files touched
- edit: `src/pages/PendingMatches.tsx`
- edit: `src/components/matches/RoundRobinMatchGroup.tsx`
- edit: `src/pages/MatchHistory.tsx` (one prop pass-through)
- edit: `src/components/matches/PremiumMatchCard.tsx` (tidy)
