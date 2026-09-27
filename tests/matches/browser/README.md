# Matches page review

Run `npx vite --config tests/matches/browser/vite.config.ts --host 127.0.0.1 --port 5212 --strictPort`, then open `/tests/matches/browser/index.html`.

The production Matches page, match cards, and player shell render with local synthetic data. The shared marketing backend fixture blocks writes and performs no network requests. The history hook is replaced with a local fixture; loader and confirmation logic have separate unit tests in `tests/matches`.

Variants: `?light`, `?other`, `?empty`, and `?error` (Try again restores the normal fixture). Test data covers 12 rounds, an unranked round, pending approvals, singles, guests, a long player name, and unknown rating movement. Profile and event links reach a local destination display that shows the requested path.

Review at 320, 390, 768, and 1440 pixels. Check the full 3 → 9 → 12 round expansion, ranked filter, profile/event destinations, read-only other-player history, error recovery, confirmation failure feedback, and keyboard focus. Guest names without linked accounts must remain plain text; rating changes must have at most three decimal places. No real scores, reports, or reminders are submitted by this fixture.
