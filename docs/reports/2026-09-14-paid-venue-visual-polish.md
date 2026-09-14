# Paid venue visual pass — September 14, 2026

Status: published to production on September 14, 2026. No database migration, entitlement change, Stripe change, native Android Studio or Google Play work.

## Production release

- Application commit: `73c382410c298afe26c028de5f5a366739a936f6`, pushed to `main` with explicit publication approval.
- [Firebase deployment run 34910022570](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34910022570): successful; job `104195223749`. CI confirmed 1,206 passing tests, 32 skipped, 10 todo, and a successful 4,712-module production build.
- Firebase Hosting version: `877ade2ab3b71a8e`.
- Live ELEVENO route returned HTTP 200 with `/assets/index-DCvX0cEX.js` and `/assets/index-DmW5NXqv.css`, matching the CI output.
- Downloaded entry JavaScript, stylesheet, `VenueCommunity-l5gYwn1R.js`, `GroupManage-B6tg2u5d.js` and `VenueEventDialog-B2M9B_nW.js` all returned HTTP 200 and matched the corresponding locally verified build content exactly. Confirmed service-card/reduced-motion styles, responsive navigation, feature-management heading and booking heading in their deployed chunks.
- `/manifest.json` returned HTTP 200 with standalone display. `/sw.js` returned JavaScript with no-cache/no-store/revalidation headers; hashed assets retained immutable caching.
- These production checks confirm release delivery, not authenticated hosted end-to-end or physical-device acceptance. Existing PWA installations may need a reload/reopen to activate the update.

## Experience changes

- Booking, programs, coaching, competition and facility operations use distinct functional colors, with text labels and icons. Venue branding remains on the masthead and decorative accents; editable brand colors no longer determine booking-selection text contrast.
- Mobile service cards are compact action rows; a sticky venue tab strip keeps navigation available while scrolling. Court selection includes a checkmark and a bounded, thumb-reachable review action. Venue home links directly to My bookings.
- Desktop uses a bounded 1,480px workspace with a left navigation column, readable content, and a context rail only from 1,280px. The home detail rail no longer squeezes the main content on smaller laptops; contact details and hours use two columns below that breakpoint when space permits. Desktop program filters wrap instead of relying on horizontal scrolling.
- Exactly one set of responsive venue tab controls is mounted at a time, removing duplicate trigger IDs. Desktop uses vertical keyboard navigation. Staff settings remain visible to authorized managers even when operations access is unavailable.
- Subtle CSS-only panel entrances and pointer feedback respect reduced-motion preferences. No animation library, dependency, entrance-duration change or chat/keyboard-layout change was added.
- Owner feature cards distinguish Paid access from Included access. Existing customers see feature management without the large introductory demo pitch, with the ownership/upgrade guide collapsed but available. Free-venue onboarding stays expanded. Feature demos, subscription management, verification links and payment availability warnings remain available.
- Long names/contact details and narrow owner buttons wrap. Functional colors have light and dark variants.

## Verification

- Final full suite: **1,206 passed**, 32 skipped, 10 todo; 95 passed files and 3 skipped. Includes 11 new presentation, access-visibility, color-contrast and owner-layout tests.
- Final production build: **4,712 modules**, successful. Existing Browserslist, duration-utility, import and chunk-size warnings remain.
- Focused ESLint passed on modified production components and the new tests. The repository TypeScript check retains its existing failure baseline; filtered diagnostics contained no errors in the changed venue components.
- Isolated browser fixture: all backend access is stubbed; no live bookings, grants, messages, payments or venue settings were changed.
- Home, booking and programs: 280, 320, 390, 430, 768, 1024, 1280, 1440 and 1920px with long unbroken venue/contact names and 125% text in dark mode. No horizontal document overflow; one venue tablist and zero duplicate IDs in each checked state.
- Owner paid-feature screen: same nine widths. Found two overflowing buttons at 280px with enlarged text; fixed their wrapping and retested that size with the upgrade guide both collapsed and expanded. Other checked sizes had no overflow.
- Visually inspected normal mobile home/booking/selection, dark desktop programs with enlarged text, dark mobile feature cards and light desktop complimentary feature cards.
- Checked program filtering, desktop ArrowDown navigation, mobile court selection/review presentation, guide expansion and the feature-list anchor. Booking/chat-disabled fixture correctly omitted those tabs. Paid and included labels remain distinct.
- Contrast tests enforce at least 4.5:1 for all 12 light/dark service tones against their icon washes and selection text colors. The actual light booking selection computed to white on `rgb(21, 101, 85)` in the browser.
- Physical-device, installed-PWA and authenticated hosted end-to-end acceptance have not been performed for this visual pass.

## Local preview

Run `npm exec vite -- --config tests/venues/browser/vite.config.ts --host 127.0.0.1 --port 8092 --strictPort`.

- Player surface: `/tests/venues/browser/index.html?surface`
- Owner features: `/tests/venues/browser/index.html?modules`
- Stress variants: add `&long&large-text&dark`; add `&subscribed` for paid labels on the owner fixture or `&no-booking&no-chat` on the player fixture.

Temporary preview server/tab were closed and the browser viewport override was reset after QA. Publication used the existing Firebase web/PWA workflow; no SQL or native Android release was required.
