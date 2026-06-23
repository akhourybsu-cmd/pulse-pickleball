## Goal
Public profile page reachable from any avatar/name tap, styled to match the rest of the PULSE player app (dark theme, lime accent, Outfit/Inter, 8pt spacing, premium card system, standard `PlayerPageHeader`).

## Current state
- `src/pages/ViewProfile.tsx` already exists and reads from the PII-safe `profiles_public` view, but it's **unreachable** — `App.tsx` redirects `/profile/:userId` to the signed-in user's own `/player/profile`.
- The existing ViewProfile uses its own ad-hoc header (logo + ThemeToggle), not the shared `PlayerPageHeader` used by Home / Find / Community / Profile.
- Avatars in friend lists, group members, posts, comments, chat, and LFG are not tappable.

## What to build

### 1. Route wiring (`src/App.tsx`)
- Replace the `/profile/:userId` redirect with `<Route path="/profile/:userId" element={<ViewProfile />} />`.
- Add `<Route path="/player/profile/:userId" element={<ViewProfile />} />` so it fits the namespaced player shell.

### 2. Redesign `ViewProfile` to app spec
Rework `src/pages/ViewProfile.tsx` to match the established player visual language used on `PlayerProfile`, `PlayerDashboard`, `FindEvents`:

- **Header:** swap the custom logo/ThemeToggle bar for `PlayerPageHeader` (icon `User`, title = player's display name, subtitle = location or "PULSE Player", `background="gradient"`, with the standard back button).
- **Hero card:** replace the current layout with the same card shell used elsewhere — `rounded-2xl border border-border/60 bg-card` with the lime gradient wash and soft primary shadow. Inside:
  - Avatar (96px, lime ring) + name (Outfit, `text-2xl font-semibold`) + handle/location row.
  - `CircularProgressRing` rating dial + W / L / Win% `AnimatedStatChip` row (already imported, just re-laid-out on the 8pt grid: `gap-4`, `p-6`).
  - `PlayStyleChip` + paddle row beneath, muted.
  - `LastPlayedBadge` aligned top-right.
- **Action row** (below hero, full-width buttons, `h-11`, primary + outline variants):
  - Primary: **Message** — only when viewer and target are friends (uses existing `useFriends` + DM open flow); falls back to **Add friend** when not yet connected.
  - Secondary: **Share profile** — same Web Share / clipboard fallback as `PlayerProfile`.
- **Highlights:** keep `HighlightsStrip` but wrap it in a `SectionHeader label="Highlights"` block to match Profile/Home grouping.
- **Recent matches:** `SectionHeader label="Recent matches"` → stack of `PremiumMatchCard` (already in use), `gap-3`, empty state card ("No matches yet") styled like other empty states in the app.
- **Self guard:** if `:userId === auth.uid()`, redirect to `/player/profile` so own-profile UX stays the canonical command center.
- **Spacing/typography:** `container mx-auto px-4 py-5 max-w-3xl space-y-7 pb-12` to mirror `PlayerProfile`. All gaps multiples of 8.
- **Animation:** same `animate-fade-up` stagger (120ms / 180ms / 240ms) used on `PlayerProfile`.

No new design tokens — reuse `--primary`, `--card`, `--border`, `--muted-foreground` already defined in `index.css`. No hardcoded colors.

### 3. Make avatars + names tappable
Add `onClick → navigate(\`/profile/${userId}\`)` (with `e.stopPropagation()` where rows are already clickable) in:
- `src/components/community/FriendsTab.tsx`
- `src/pages/player/Friends.tsx`
- `src/components/community/GroupMembers.tsx` (also add a "View profile" item to `MemberActionSheet`)
- `src/components/community/GroupFeed.tsx` — post author avatar + name
- `src/pages/PostDetail.tsx` — post author + each comment author
- `src/components/community/ChatMessage.tsx` — sender avatar
- `src/components/community/GroupLFG.tsx` — LFG post author
- `src/components/community/ConnectSheet.tsx` — suggested-friend rows

No backend changes — `profiles_public` already exposes the safe fields under authenticated RLS.

## Out of scope
- Editing visibility / privacy controls.
- Venue-mode profile variant.
- SEO / OG metadata for the public URL.

## Files touched
- `src/App.tsx`
- `src/pages/ViewProfile.tsx` (visual rebuild on existing data layer)
- `src/components/community/FriendsTab.tsx`
- `src/components/community/GroupMembers.tsx`
- `src/components/community/MemberActionSheet.tsx`
- `src/components/community/GroupFeed.tsx`
- `src/components/community/GroupLFG.tsx`
- `src/components/community/ChatMessage.tsx`
- `src/components/community/ConnectSheet.tsx`
- `src/pages/PostDetail.tsx`
- `src/pages/player/Friends.tsx`
