# Public homepage marketing pass — September 8, 2026

## Scope

Updated the anonymous `/` landing page, not the authenticated player Home tab. The shared public navigation and footer also appear on `/players`. Index's session check and authenticated/deep-link redirects are unchanged. No database changes, migrations, new dependencies, or live-data writes.

## Changes

- New editorial hero and restrained cream/ink/gold styling, with a bounded desktop layout and stacked phone layout.
- Benefit-led explanations of matches, PULSE ratings, discovery, friends/community, round robins, and leagues.
- Organizer sections explain scheduling, guests, court assignments, fairness tools, seasons, and member participation. Removed outdated divisions and unconditional rating-growth claims.
- Three code-native product illustrations replace decorative placeholder icons. Every illustration explicitly identifies its sample data; none is a live schedule or testimonial.
- Native keyboard-operable FAQs cover audience, free signup versus possible additional costs, browser access, PULSE versus DUPR ratings, and bringing an existing group.
- Signup links now use `/auth?mode=signup`. Separate sign-in links remain available on desktop and mobile.
- Public navigation explains the product instead of advertising login-required discovery/community pages as anonymous browsing. Cross-page anchors wait for the anonymous homepage to mount.
- Consistent PULSE branding, larger touch targets, visible focus states, a skip link, reduced-motion styling, and scoped light/dark colors.
- Updated static search/share metadata and client-side page metadata with matching copy.
- No images, animation libraries, or additional network requests were added to the public presentation. Removed its framer-motion usage.

## Verification

- Full Vitest suite: **716 passed, 32 skipped, 10 todo** (53 passing files, 3 skipped).
- Eight new SSR/content regression tests cover landmarks, navigation anchors, signup intent, protected-route boundaries, sample-data disclosures, FAQ content, signed-in shared navigation, and metadata consistency.
- ESLint passed for changed TypeScript/TSX files and tests.
- Production build passed in 29.60 seconds. Existing Browserslist, Tailwind duration, sonner import, and bundle-size warnings remain.
- App-wide TypeScript checking still reports the previously known unrelated venue/tournament/round-robin/profile/group errors. No homepage errors were reported; this is not a claim of a clean repository-wide typecheck.
- Browser QA used the actual app on a separate logged-out local origin, without signing the user out of production. The primary CTA opened the real Create Account form with first/last name and confirmation fields; no account was created.
- Desktop and phone screenshots reviewed in light and dark modes. Mobile drawer opened, fit within the viewport, and closed when following its FAQ link. FAQ click and Enter-key expansion/collapse worked. Navigation from `/players` to `/#organizers` landed on the correct section after the auth check.
- Responsive iframe checks at **320, 390, 600, 768, 1024, 1440, and 1920 CSS viewport pixels** found no horizontal overflow or desktop-navigation overlap. The diagnostic distinguishes viewport width from content width because Windows uses non-overlay scrollbars. This is browser viewport QA, not testing on physical iOS/Android hardware.
- Calculated contrast for the selected solid-color pairs: gold-button text 8.54:1, light body copy 5.71:1, dark body copy 8.92:1, hero body copy 10.34:1. No blanket accessibility certification is implied.

## Reproduce

Run `npm run dev -- --host 127.0.0.1 --port 8081 --strictPort`, then open `/tests/marketing/browser/responsive.html` on that origin. It embeds the actual anonymous homepage, offers viewport and section controls, and reads visible layout geometry. This development fixture is not a production route or build entry.

Run `npx vitest run tests/marketing/publicHomepage.test.tsx` for the focused regression suite.

## Release

Implementation commit: `aba45bb0` on main. Firebase Hosting deployment #15 completed successfully: https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34222668500.

An anonymous HTTP request to `https://pulsepb.com/` returned 200 with the new title and description after deployment. Opening the Firebase hosting domain in the existing signed-in browser correctly redirected to the unchanged player dashboard; no user was signed out. A separate logged-out local preview was left open for visual review. SQL is not required.
