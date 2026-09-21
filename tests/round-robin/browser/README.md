# Round Robin creation design QA

The preview mounts the real WizardContainer and its real step, picker, calendar, and schedule components. Only backend calls and data hooks are replaced with in-memory fixtures; it never reads credentials or writes to Supabase.

Run from the repository root:

```powershell
node node_modules/vite/bin/vite.js --config tests/round-robin/browser/vite.config.ts --host 127.0.0.1 --port 5182 --strictPort
```

Open http://127.0.0.1:5182/tests/round-robin/browser/index.html. Optional query parameters: `?dark`, `?group`, `?no-groups`, `?large-text`. Completing creation shows the captured insert payloads, including any roster, group-feed, and calendar writes.

## Verified on September 21, 2026

- Production Vite build: passed.
- Focused ESLint on the wizard and PlayerPickerSheet: passed.
- Existing Round Robin suites: 16 files, 165 tests passed (`vitest run src/lib/roundRobin tests/round-robin`).
- Browser viewports: desktop 1440x960, tablet 768x1024, mobile 390x844 and 320x812. Light and dark themes inspected. Fixed narrow date-field overflow and desktop picker centering during QA.
- Immediate event: registered roster selection, custom game count, time preset, rating type, group choice, review edits and return, then creation with expected event, roster, post, and calendar payloads.
- Future event: women's format, invite-only access, registration cap, calendar selection, deadline preset, no-groups state, review, and creation with invite-only mode and public publishing disabled.
- Count-only setup and skipping optional steps reach review.
- Revisiting Details and removing its required name disables progression; jumping to Review cannot bypass final validation and routes back to Details. The correction notice appears at the top to leave the mobile footer accessible.
- Player picker: Friends, Group, Recent, Search, Guest; keyboard arrow navigation changes the active tab. Adding a sample guest with gender and a balanced mixed roster reaches the existing schedule projection. Ratings remain disabled while guests are allowed.
- Motion respects reduced-motion preferences through the existing Framer hooks and scoped CSS. No browser-level preference emulation was available; this was inspected in code.

## Scope and limits

Visual changes cover all nine creation steps. Event insert payload logic, scheduler algorithms, database migrations, management pages, and player pages were not changed. The picker has an opt-in creation class; its accessible dialog titles and keyboard tabs also benefit existing callers.

The full TypeScript check still reports errors in untouched tournament components, group hooks, Dashboard, PlayerTabsPreview, and roundRobin/scheduleAdjustment. It reports none in the edited components. Live Supabase integration was not exercised in this design preview.
