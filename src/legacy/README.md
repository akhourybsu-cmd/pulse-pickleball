# Legacy / recycling bin

Retired player-facing features, kept on disk so they can be revived later.
**Nothing here is routed or imported by the live app.** These files are not
deleted on purpose — treat this folder as an archive.

Courts and venues are no longer their own player surfaces; everything player-
facing lives in the Community tab, and the only kiosk we ship now is the
round-robin kiosk (`/round-robin/:id/kiosk`, still live).

## Stashed here (moved into `src/legacy/`)

| File | Was reachable at | What it was |
|------|------------------|-------------|
| `CourtBoard.tsx` | `/court/board`, `/court/board/:courtId` (+ vanity `/pickleballciti`, `/masonfield`, `/tildastone`, `/naymca`) | The per-court "who's up / feed" board display. |
| `PostDetail.tsx` | `/court/feed/:postId` | Detail view for a court-feed post. |
| `Reservations.tsx` | `/reservations` | Court reservation calendar. |
| `MyCalendarRegistrations.tsx` | `/events/my-calendar-registrations`, `/my-registrations` | Legacy "my registrations" page over the old `calendar_events` system. Superseded by the "Your upcoming play" section on the Play hub, which uses the live `unified_events` system. |
| `PlayerBookings.tsx` | (unused) | Thin re-export of `MyCalendarRegistrations`. |
| `PickleballCitiMemberships.tsx` | `/pickleball-citi-memberships` | Venue-specific membership marketing page; its CTA pointed at the retired court board. |

## Still in place but ALSO dead (not moved to avoid churn / shared folders)

These were already unrouted or redirect-only and reference the retired court
system. They render nowhere. Left where they are because some sit in folders
shared with live code (e.g. `components/court/` also holds `WhosUpBoard` /
`QueueBoxSystem`, which the still-live admin `SessionQueue` uses):

- `src/components/court/SmartMatch.tsx`, `src/components/court/LFGNotifications.tsx` — the LFG "Discover play" cards; linked to `/court/board/:id`. Their only consumer was the dashboard's "Discover play" section, which has been removed, so they are now unused. (Note: `src/pages/Dashboard.tsx` is NOT dead — it is the live dashboard, re-exported by `PlayerDashboard`.)
- `src/components/court/feed/CourtFeed.tsx`, `CommunityHub.tsx`, `PostCard.tsx` — old court social feed.
- `src/components/reservations/CalendarView.tsx` — links to `/pickleballciti`.
- `src/components/citi-events/JoinableCalendarEvents.tsx` — links to `/reservations`.
- `src/pages/player/MyBookings.tsx`, `src/pages/player/PlayerCoaching.tsx` — redirect-only routes.
- `src/components/player/VenueDetailSheet.tsx`, `VenueDiscoveryCard.tsx` — never imported.

## How to revive something

1. Move the file back to its original folder (e.g. `src/legacy/CourtBoard.tsx`
   → `src/pages/CourtBoard.tsx`). Imports use `@/` aliases, so they keep working.
2. Re-add its `lazy(() => import(...))` line and `<Route>` in `src/App.tsx`.
   The retired routes were:
   - `CourtBoard` → `/court/board` and `/court/board/:courtId`
     (+ vanity redirects `/pickleballciti`, `/masonfield`, `/tildastone`, `/naymca`
     → `/court/board/<courtId>`).
   - `PostDetail` → `/court/feed/:postId`
   - `Reservations` → `/reservations`
   - `MyCalendarRegistrations` → `/events/my-calendar-registrations` (+ alias `/my-registrations`)
   - `PickleballCitiMemberships` → `/pickleball-citi-memberships`
3. If reviving a court/venue page for players, remember the product decision
   that venue pages (`/v/:slug`) remain admin-gated.
