## Summary
Add a compact, glanceable "My Friends" section to the authenticated player Dashboard (home page), reusing the existing horizontal-rail pattern established by `MyCommunitiesRail`.

## Placement
Insert the new section into both the desktop (`lg:grid`) and mobile (single-column) layouts in `src/pages/Dashboard.tsx`, positioned immediately after **My communities** so social connection surfaces are grouped together. The section follows the same staggered `animate-fade-up` delay pattern as its neighbors.

## New Component: `MyFriendsRail`
Create `src/components/dashboard/MyFriendsRail.tsx` with these responsibilities:

- **Data:** Use the existing `useFriends` hook to fetch accepted `friends` and `pendingRequests`.
- **Empty state:** If no friends and no pending requests, render a compact CTA tile that links to `/player/friends` — copy similar to the communities empty state ("Find players and build your crew").
- **Pending requests:** If there are pending received requests, show a small "pulse" dot or count badge on the first avatar slot (or as a dedicated incoming-request tile) to draw attention without needing a separate full notifications surface.
- **Rail layout:** Horizontal scrollable row of avatar + name pills, matching `MyCommunitiesRail` sizing (`w-24`, `h-14` avatar, `rounded-2xl`, `gap-3`).
- **Avatar:** Use `Avatar` / `AvatarImage` / `AvatarFallback` with the friend's `avatar_url` and initials derived from `display_name` or `full_name`.
- **Tapping a friend:** Navigate to `/player/profile/${friend.profile.id}` (or the public profile route if that is the canonical player profile path).
- **"Find more" tile:** A trailing `+` tile that links to `/player/friends` so users can discover/add friends.
- **Loading:** Skeleton rail identical to `MyCommunitiesRail`.

## Dashboard Integration
In `src/pages/Dashboard.tsx`:
- Import `MyFriendsRail`.
- Add a `<SectionHeader label="My friends" action={<Link to="/player/friends">View all →</Link>} />` + `<MyFriendsRail />` block after the My communities block in both desktop and mobile columns.
- Preserve the existing `animationDelay` cadence so it staggers in naturally.

## Out of Scope
- No changes to the `/player/friends` page itself.
- No changes to the `friendships` schema or `useFriends` hook.
- No new routes.
- No backend or RLS changes.

## Acceptance Criteria
- Dashboard loads without errors.
- Accepted friends appear as horizontal scrollable avatars with names.
- Empty state links to the friends page.
- Tapping a friend navigates to their profile.
- "View all →" goes to `/player/friends`.
- Layout is consistent on mobile and desktop.