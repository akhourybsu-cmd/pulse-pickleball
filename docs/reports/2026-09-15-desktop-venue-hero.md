# Compact desktop venue hero

Status: published September 15, 2026 in application commit `dfa899e151a19386df95b78a6e5489ffbed4fb3d`. [Production release checks](2026-09-15-venue-mobile-shell.md#production-release) confirmed a successful Firebase deployment and matching live assets.

## Changes

- Facility venue cover height is now 96px at the desktop breakpoint and 112px from 1280px upward, rather than a cover that could grow to 288px.
- The logo is 48px, with a smaller venue name and tagline below the cover in both filled and full-photo modes. Full-photo mode no longer adds a larger identity composition.
- The complete standard desktop header measures 228–244px including top spacing, identity and real status labels. Existing content columns and booking/program destinations are preserved.
- Saved cover fit/focal point and logo fit/shape remain unchanged. Cover controls have a readable dark backing and visible keyboard focus; staff controls retain their permission gates.
- Free venue community covers use the same 96–112px desktop cap. The subsequent mobile consistency pass moved their phone banner into feed content; see the linked mobile report.
- Owner image previews now reflect the compact desktop cover and the already-published mobile club cover. No venue image or stored setting was changed.

## Verification

- 29 focused tests passed across image presentation, mobile club home and service surfaces.
- Final production build passed: 4,719 modules. Existing build warnings remain.
- Focused ESLint passed for VenuePageChrome, VenueImagePreview, VenuePreview and image-presentation tests. The one-class free-community change was covered by a regression assertion and the production build; unrelated GroupDetail lint debt was not changed.
- Browser geometry checks at 1024, 1280, 1440, 1920 and 2560px: no document overflow; all cover controls within bounds. Standard header height remains capped at 244px on ultrawide displays.
- Full-photo mode, dark mode, long names and 20px root text checked at 1024/1280px without overflow. Larger text can expand the layout for accessibility.
- Local operations callback verified; player fixture hides staff controls. At the original desktop-only validation, the mobile header measured 198.5px at 390px width. The subsequent mobile consistency pass supersedes this with a persistent app bar and navigation; its current measurements are in the linked report.
- Browser testing used the local backend-isolated venue fixture, not production transactions. Free-community desktop cap was verified in source regression/build rather than a full authenticated free-community browser flow.
- Git diff whitespace check passed. No database migration, payment/authentication change, Android Studio or Google Play update.
