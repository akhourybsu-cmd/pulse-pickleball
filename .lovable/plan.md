# Swap "Play" → "Community" in Bottom Nav

The Play tab in the player bottom nav becomes the Community tab. `/player/play` (PlayHub) stays reachable from the Home dashboard tiles and existing deep links — it just leaves the primary nav.

## Changes

### `src/components/layout/PlayerShell.tsx`
1. **Imports:** swap `Compass` for `Users` from `lucide-react`.
2. **`navItems` array:** replace
   ```
   { to: '/player/play', icon: Compass, label: 'Play' }
   ```
   with
   ```
   { to: '/player/community', icon: Users, label: 'Community' }
   ```
3. **`prefetchMap`:** replace the `'/player/play'` entry with `'/player/community': () => import('@/pages/player/Community')`.
4. **Active-route detection:** the existing `activeIndex` logic uses `location.pathname.startsWith(item.to)`, so `/player/community`, `/player/community/group/:id`, and `/player/friends` all need consideration. To keep Community highlighted on its sub-routes (groups, friends), add `/player/friends` to the same match group — e.g. treat `pathname.startsWith('/player/community') || pathname.startsWith('/player/friends')` as the Community tab.

### No other files change
- `/player/play` route stays registered; PlayHub is still linked from Home (`ExploreCard`, `QuickActionsBar`) and any existing redirects.
- Community page already exists at `/player/community` with the new 2-tab hub design and Friends entry.
- No backend or schema changes.

## Technical notes

- Icon choice: `Users` matches the Community concept and is already used inside the Community page action row.
- The animated underline pill in PlayerShell is index-driven, so swapping the array entry is enough — no width math changes.
