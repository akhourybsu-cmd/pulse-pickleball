# Mobile venue club home

Status: published to production September 15, 2026 (America/New_York), following explicit publication approval.

## Production release

- Application commit: `91792cfb87743e0fbc5d80858901eade7ccc6626`, pushed to `main`.
- [Firebase deployment run 34927217493](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34927217493), job `104247694097`: successful. CI confirmed 1,244 passing tests and a successful 4,719-module build.
- Firebase Hosting version: `989974437d77cf5d`.
- Public home and `/player/community` returned HTTP 200 and referenced `/assets/index-CxRwuVYS.js` and `/assets/index-YwtjDld2.css`.
- Entry JavaScript, stylesheet and `/assets/VenueCommunity-Dc_RioDj.js` returned HTTP 200 and matched the tested local build byte-for-byte.
- `/manifest.json` returned HTTP 200 with standalone display. `/sw.js` returned HTTP 200 as JavaScript with no-cache/no-store/revalidation headers. Both match local content after normalizing Windows CRLF to the Linux deployment's LF line endings.
- Release delivery is verified; this does not claim live authenticated booking, RSVP or messaging transactions. Existing web/PWA sessions may need a reload or reopen to load the new app entry.

## Scope

Reworked the facility-enabled venue player route used by ELEVENO below the 1024px desktop breakpoint. Ordinary communities and free community-only venue routing remain unchanged. Existing desktop masthead, bounded content columns and contextual rails are retained; Events & schedule is also reachable on desktop so the URL survives resizing.

No schema migration, venue settings or entitlement change, booking/payment write, image replacement, authentication change, or Android Studio/Google Play build was performed. The web release will also serve the Android PWA.

## Player experience

- Approximately 199px cover/identity/status header at standard phone text size, expanding when needed for accessibility. Venue cover fit/focal point and logo fit/shape remain honored; failed images fall back safely.
- Book a Court leads Overview, with Join Open Play and View Schedule beneath. Booking opens a focused flow with a named return action rather than another primary tab.
- Five horizontally scrollable, keyboard-accessible tabs: Overview, Play, Community, Events and About. Existing home/book/play/feed/chat/more URLs remain valid.
- Play initially selects open play and also offers clinics. Events exposes the full existing program calendar and registration dialog. Event creation stays permission-gated.
- Community groups posts, the existing member list and the existing immersive chat. Social chat deep links remain direct. Chat returns to Community when entered from the venue.
- Upcoming/in-progress sessions, ways to play and community appear before the description. About contains saved hours, location and contact details.
- Removed the owner-facing feature/upgrade strip from the venue home; management remains accessible to authorized staff.
- Accent is inherited from the venue, with contrasting button text. Neutral PULSE surfaces remain dominant. Touch targets are at least 44px; tab underline/press feedback respect reduced motion.

## Data and behavior

- No invented ratings, indoor classifications, playing counts, followers or opening times. Missing hours and unavailable schedules are labeled as such.
- Uses venue-local dates and opening status. Skill bands retain quarter-point precision (3.75).
- Uses existing day-program RSVP totals when confirmed; future sessions without a known roster total link to availability instead of inventing remaining spots.
- Community preview reads at most four active group members and only public name/avatar fields. Cache is viewer-scoped and the read is enabled only for mobile Overview; no second presence subscription was introduced.
- Returning to Overview through browser history restores today's calendar context. Internal court holds are excluded from the home sessions.
- Booking, membership, registration, payment and moderation permission checks remain in their existing workflows.

## Verification

- Full Vitest suite: 1,244 passed; 32 skipped; 10 todo (99 passing files, 3 skipped).
- Final focused venue/navigation regression run: 76 passed across four files.
- Production build: passed, 4,719 modules. Existing Browserslist, ambiguous duration utility and mixed sonner import warnings remain.
- ESLint passed for all touched production TS/TSX presentation and data-loading files and the preview component.
- Repository TypeScript check still reports the pre-existing 27 diagnostic lines in tournament types, chat RPC typing, realtime comment typing, round-robin capacity typing, dashboard profile typing and PlayerTabsPreview callbacks. No diagnostics remain in files changed by this pass.
- Git diff whitespace check passed.

Browser checks used the local, backend-isolated real-component harness, not production mutations:

- No document overflow at widths 280, 320, 390, 430, 768, 1024, 1280, 1440 and 1920px.
- Long unbroken venue names and 20px root text tested at 280–768px; an overflowing section heading was corrected. Dark mode and About remained within bounds.
- Booking entry/return, Play, Events, Community player switch, About and arrow-key tab navigation verified. The selected horizontal tab scrolls into view.
- Verified loading, empty, error/retry, unknown availability, disabled booking/chat and failed-image states. Contain image fit was measured in the browser.
- Visually inspected mobile hero/actions/session cards and the retained desktop layout. Preview names, schedules and cover SVG are local fixture data, not changes to ELEVENO.

Live authenticated booking, RSVP and messaging transactions were not repeated for this presentation-only pass. Publication checks are recorded above.
