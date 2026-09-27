# Venue palette refinements

Kept the current venue layout, navigation and booking flow. Expanded the existing two-color editor into seven roles: primary actions, secondary/header, accent/highlights, page background, cards/dialogs, text and logo background.

The editor includes a live palette preview, native color pickers, hex entry (including shorthand), validation and an Auto reset for each role. Saving updates the management theme without resetting the editor. Logo backgrounds apply consistently while images load, after they load and when initials replace a missing image.

Venue pages, community views, management, operations, booking dialogs, drawers and menus use local semantic theme tokens. Ordinary communities and other PULSE screens retain their own theme. Button labels, body text and brand-colored links adapt for contrast; functional success/error colors retain their meaning. Automatic page and card colors follow light/dark mode.

## Verification

- `node node_modules/vitest/vitest.mjs run src/lib/venues tests/venues --maxWorkers=2`: 490 tests passed across 42 files. One existing PGlite platform-admin test timed out when tests ran alongside the build/typecheck; the final suite passed without those concurrent processes.
- Development build verified with `node node_modules/vite/bin/vite.js build --mode development`.
- ESLint on the changed portal components and new theme hook passed; the existing `VenueBrandMark` helper export still has its Fast Refresh warning.
- Browser checks: desktop and 390px mobile layouts, automatic dark palette, actual editor saves using local fixtures, shorthand color expansion, booking dialog surface colors, duration selection and dismissal. Clean browser logs after the final dialog integration fix.
- Project TypeScript checking still reports unrelated errors in tournament pool types, chat/realtime, round-robin scheduling, Dashboard and PlayerTabsPreview. No venue palette errors appeared in that check.

## Release requirement

Apply `supabase/migrations/20260927100000_venue_color_palette.sql` before deploying the frontend. It adds five nullable, hex-validated fields and leaves existing colors and access policies intact. The migration was exercised against local PGlite data, including existing rows, valid shorthand, invalid values and resets to NULL.

These are local changes. No production database migration or deployment was performed. Existing unrelated working-tree edits were preserved.

Local preview while the development server runs:

- `/tests/venues/browser/index.html?surface&palette`: sample expanded venue palette.
- `/tests/venues/browser/index.html?images`: actual branding editor with local-only saves.
- `/tests/venues/browser/index.html?dialog&palette`: themed booking review with external checkout blocked.
