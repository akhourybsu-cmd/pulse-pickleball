# Venue-branded entrance — September 14, 2026

Status: implemented locally; pending publication alongside the previous venue booking/owner-polish pass. No migration, production data changes, new package, or Android Studio/Google Play work.

## Experience

- Venue communities open with a centered venue logo, restrained animated ring, venue name and branded backdrop. Identity comes from the existing administrator-managed logo, fit, shape and brand colors.
- Available to both free venue communities and venues with paid modules; ordinary communities retain their existing transition.
- Admins can open **Manage venue → Profile & brand → Your venue’s entrance → Preview entrance**. The inline preview responds to the current form without saving it. Existing save/upload behavior remains unchanged.
- The entrance has a 480ms minimum presentation while the route prepares behind it, not an additional delay after preparation. It waits longer only for actual route/module readiness. Tab/query-parameter changes do not restart it; changing venues starts a fresh entrance.
- Reduced-motion preferences disable decorative movement and skip the minimum interval. Background content is inert/hidden from assistive technology while the entrance is active; no transform is added around fixed chat panes.
- Slow loads show a clearer explanation after seven seconds. A Community exit is always available. Feature-load errors bypass the entrance so retry/free-community recovery controls remain usable.
- Missing/broken logos use venue initials. The new shared mark also improves the facility masthead's broken-image handling. Images can fade in without holding navigation for an image download.
- Brand colors are validated and the backdrop is darkened to preserve text contrast. The logo matte uses the configured secondary color; fallback initials retain a readable dark matte.
- Before the authenticated group query returns a venue identity, the ordinary loading placeholder remains. No separate unscoped/private-branding cache or extra backend query was introduced.

## Verification

- Full test suite: **1,171 passed**, 32 skipped, 10 todo (91 passed files, 3 skipped). The entrance/route subset passed all **17** checks again after final logo-rendering refinements.
- Production build passed. Existing Browserslist, duration utility, import/chunk-size warnings remain.
- Browser QA used actual components and bundled Palace/Citi logos with local mocked data; no real venue changes or checkout actions.
- Entrance and admin preview: 280, 320, 390, 430, 768, 1024 and 1440px with no page-width overflow. Larger 125% text and long venue names checked at 280, 320, 390, 430 and 844px.
- Verified admin draft name changes update the preview. Verified readable stacked controls and a square logo/ring frame in narrow previews.
- Verified normal entrance → content; Chat tab switch without entrance replay; venue change to Citi with distinct logo/name; broken-logo initials; slow-loading explanation and exit link.
- Unit coverage includes reduced-motion changes, timer cleanup, hidden pending content, immediate error bypass, free/facility routing, direct chat parameter preservation and safe branding fallbacks.

Local fixture: existing `tests/venues/browser/vite.config.ts` with `?entrance=screen`, `?entrance=flow`, `?entrance=slow&broken-logo`, or `?entrance=admin`. Append `&large-text`, `&long-name`, or `&no-logo` for edge cases. Backend mutations are blocked.

This pass does not mark the broader venue acceptance matrix or live Stripe launch complete. Remaining priorities from the prior venue report—cross-venue financial isolation, checkout/refund edge cases, installed-PWA returns, staff/ownership transitions and event lifecycle checks—remain open.
