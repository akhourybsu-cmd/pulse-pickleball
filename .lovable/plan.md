## Goal
Compartmentalize every venue- and tournament-related surface so the live player app behaves as if those features don't exist. Code stays in the repo (nothing deleted) so it can be revived later, but normal users never see, link to, or land on any of it. Only platform admins (`user_roles.role = 'admin'`) can reach the archived surface.

## What changes for normal users
- No `/venue/*` page is reachable. Public `/venues`, `/v/:slug`, `/venue/:slug` (white-label landing), `VenuesLanding` marketing page, and the entire `/venue` console redirect to `/player/dashboard`.
- No `/tournament*` or `/tournaments*` page is reachable. `TournamentsLanding`, `BrowseTournaments`, `TournamentLanding`, `TournamentRegister`, `TournamentLiveView`, `TournamentTeamView`, `TournamentDetail`, `TournamentCustomize`, payment-success/cancel, and the `/tournament-admin/*` set all redirect to `/player/dashboard` for non-admins.
- The "Switch to venue" `ModeSwitcher` in the page header is removed for all users (even those with venue memberships) for now.
- Player nav loses any links to `coaching`, `bookings`, `my-bookings`, venue discovery, "follow venue", "favorite venue", and tournament browse.
- `EnablePushBanner`, dashboard cards, and Find Play remain untouched — they have no venue/tournament dependency.

## What still works (unchanged)
- Round Robins, Matches, Community/Groups, Messages, Friends, Profiles, Notifications, Guests, Push.
- Match recording and rating math.
- The legacy `/venue/round-robins/:id/kiosk` and `/venue/round-robins/:id` redirects keep working because they shim to the unified `/round-robin/:id` route — those stay, since they're just URL aliases the kiosk QR codes rely on.
- All `venue_*`, `tournaments_*`, `unified_events`, and `financial_transactions` tables remain in the database. RLS is untouched. Nothing user-facing reads them anymore from the player app.

## Admin escape hatch
A new `/archive` index page (admin-only) lists every archived surface and links into the existing `/venue/*` and `/tournament*` routes. To reach the archived UI, an admin navigates to `/archive` and clicks through. All archived routes are wrapped in `AdminGuard`, so even a direct URL works for admins and bounces everyone else.

## Implementation outline (technical)

### 1. Route gating in `src/App.tsx`
- Wrap every venue route group in `AdminGuard`:
  - `/venues`, `/v/:slug`, `/venue/:slug` (public landings) → `AdminGuard`.
  - `/venue` shell tree (Overview, Profile, Branding, Facility, Media, Courts, Bookings, Events, Tournaments, RoundRobins, Coaching, Staff, Settings, Analytics) → wrap the parent route in `AdminGuard`.
  - `/venue/onboarding/*`, `/venue/create-fast`, `/venue/interest`, `/venue/verification-pending` → `AdminGuard`.
  - Keep `/venue/round-robins/:id/kiosk` and `/venue/round-robins/:id` redirect shims public (they're just unified-route aliases).
- Wrap every tournament route in `AdminGuard`: `/tournaments`, `/tournaments/browse`, `/tournaments/manage`, `/tournaments/new`, `/tournaments/:id*`, `/tournament/:slug`, `/tournament/:eventId/*`. `/tournament-admin/*` is already admin-gated.
- Remove `/player/coaching`, `/player/bookings`, `/player/my-bookings` from the `PlayerShell` children, or wrap them in `AdminGuard` (they only make sense with venues). `MyEvents` stays — it covers Round Robins / Community.
- `AdminGuard` already redirects non-admins to `/player/dashboard` with a toast.

### 2. Strip player entry points
- `src/components/PageHeader.tsx`: remove the `ModeSwitcher` render entirely (was already conditional on `hasVenueAccess`). Keep the import for the admin archive page.
- `src/components/dashboard/ExploreCard.tsx`: delete the "Tournaments" and "Venues" tiles. (Component is already unused per the Dashboard comment, but I'll prune the file so a future re-mount is safe.)
- `src/components/dashboard/VenueActivitySection.tsx`, `RoleSwitcherCard.tsx`: leave on disk, no-op exports (already not mounted).
- `src/components/onboarding/*`: remove any "Visit a venue", "Book a court", or "Browse tournaments" copy/steps. Verified none of the active onboarding steps reference these.
- `src/pages/Index.tsx` and `src/pages/PlayersLanding.tsx`: scrub any "Find a venue" / "Browse tournaments" CTAs from the marketing surface; replace with "Find Play" / "Join a community".
- Notification deep links: any notification that points at `/venue/*`, `/tournament/*`, or `/player/bookings` will now hit the admin redirect. I'll patch the dispatch SQL (`notif_url` builders) to suppress those notification types for now (they're orphaned), matching the prior cleanup of "Open Play Session" notifs.

### 3. Admin archive index
- New page `src/pages/admin/AdminArchive.tsx` wrapped in `AdminGuard`, route `/archive`. Sectioned list:
  - **Venues** — links to `/venue`, `/venues`, `/venue/create-fast`, `/admin/venue-verification`.
  - **Tournaments** — links to `/tournaments`, `/tournaments/manage`, `/tournament-admin`.
  - **Public landings** — `/v/:slug` (with a slug picker pulled from `venues`).
- Add a card on `AdminDashboard` pointing at `/archive`.

### 4. Database posture (recommended)
No destructive migrations. The user picked "Other / whatever is recommended"; the safest path is:
- **Leave all `venue_*` and `tournaments_*` tables, RLS, and grants exactly as they are.** RLS already restricts writes to venue staff / event organizers, and reads are mostly scoped or via public views the player app no longer calls.
- **Disable the `unified_events` sync triggers from tournaments and venue_events** so archived activity stops landing in the unified discovery feed (which `FindEvents` reads). Triggers are dropped but the underlying functions remain, so a single `CREATE TRIGGER` re-enables them when we resurrect the surface.
- **Suppress orphaned notification dispatchers** for booking reminders, venue announcements, tournament alerts. The corresponding `pg_cron` schedules get unscheduled (not deleted) and the trigger functions stay in place. This matches how `send-group-event-reminders` was archived earlier.

I'll bundle the trigger drops + cron unschedules into one migration that's fully reversible.

### 5. Verification
- Build passes.
- Playwright: signed-in non-admin tries `/venue`, `/venue/123`, `/tournaments`, `/tournament/foo`, `/v/anything` → each redirects to `/player/dashboard`.
- Signed-in admin reaches `/archive` and can click into `/venue` and `/tournaments` without redirect.
- `FindEvents` no longer surfaces tournament rows (sync disabled), only the player-relevant event types.
- Notification bell shows no new venue/tournament notifications after the cron pause.

## Out of scope
- Deleting venue/tournament tables, RLS policies, or edge functions.
- Refactoring `unified_events` to drop venue/tournament columns.
- Reworking Stripe Connect, financial_transactions, or subscription tiers.
- Player-facing copy beyond the marketing landing and onboarding scrub.

I'll execute this end-to-end on approval.
