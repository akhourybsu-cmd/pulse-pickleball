# Integrate Friends into Community Hub

Keep the clean 2-tab Community design (My Community | Explore) and surface Friends as a prominent entry point that routes to its own full page — visible, but not cluttering the hub.

## Changes

### 1. New `FriendsEntryCard` inside My Community
Add a compact card/row under the action buttons in the **My Community** tab, above "Your Groups":

- Avatar stack of up to 4 friends (using `useFriends` + cached profiles)
- Title: "Friends"
- Subline: "{N} friends · {M} pending" (pending count uses `pendingRequests.length`; hidden when 0)
- Right-side chevron
- Entire card is a button → navigates to `/player/friends`

If user has 0 friends and 0 pending: show empty-state variant ("Add friends to play with" + "Find friends" CTA) routing to the same page.

### 2. New dedicated page: `/player/friends`
Create `src/pages/player/Friends.tsx` with a standard player-mode header (back button → `/player/community`, title "Friends") and three sub-tabs:

- **Friends** — accepted friends list with message + remove actions
- **Requests** — pending received (accept/decline) + sent requests (cancel), with a count badge on the tab
- **Suggestions** — `useFriendSuggestions` results with "Add" button

Reuses existing `useFriends` and `useFriendSuggestions` hooks; no new backend work.

### 3. Route registration
Add `<Route path="/player/friends" element={<Friends />} />` in the player routes section of `src/App.tsx` (lazy-loaded to match siblings).

### 4. No removal of existing surfaces
The existing `Friends` references elsewhere (DM list, profile pages) stay untouched — this only adds the dedicated hub page and the Community entry point.

## Technical notes

- Files created: `src/components/community/FriendsEntryCard.tsx`, `src/pages/player/Friends.tsx`
- Files edited: `src/pages/player/Community.tsx` (insert `FriendsEntryCard` in My Community tab), `src/App.tsx` (route)
- Styling follows existing `GroupCard` / player-mode card conventions (white card, 8pt spacing, Outfit/Inter typography)
- No schema, RLS, or edge-function changes
