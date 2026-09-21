# Organizer command center

A Command center button above the event header opens a viewport-filling organizer dialog whenever a saved schedule exists. Live courts, Next up, and Schedule stay pinned to the bottom. Hosts move between courts with arrows or a picker, browse saved rounds directly, and access resting players as a separate page. Desktop shows the teams side by side; phones stack them. Brief PULSE transitions honor reduced motion.

The surface reuses the event page's score state, score submission, start, round-close, completion, and realtime refresh handlers. Browsing never updates the active round. Live score entry excludes byes, abandoned games, historical rows, closed events, and saved results. The existing round-progress helper determines readiness to advance; drafts retain the four-player minimum. Failed saves and closing/reopening retain draft scores. Focus is trapped inside the dialog and returns to its launch button on close; Escape closes it.

The dialog fills the available browser viewport, including safe-area insets, and follows VisualViewport changes for the mobile keyboard. Extremely short viewports, enlarged text, or long resting lists can scroll inside the court area while navigation remains fixed. Native browser chrome is controlled by the mobile browser.

## Verification

- 19 Round Robin test files / 181 tests passed, including canonical schedule navigation, empty/final rounds, zero scores, abandoned/byes, and score permission guards.
- Focused ESLint passed. TypeScript reported no errors in edited application files; existing unrelated project diagnostics remain.
- Production build passed outside the filesystem sandbox; existing chunk-size warnings remain.
- Browser fixtures inspected at 390 × 844, 375 × 667, 320 × 568, and 1440 × 900. Standard court content fits the viewport without scrolling at all four sizes; desktop teams appear side by side.
- Dark appearance, long player names, 12-court layout fixture, direct round/court selection, resting-player page, past results, next/final round, draft, completed, and voided displays checked.
- In-memory fixture saves verified an 11–0 result, progress from 0/2 to 2/2, then explicit advancement to Round 3. Failed saves retain entered scores; closing/reopening retains unsaved entries. Next up and Schedule browsing leave the live round unchanged.
- Keyboard End selects the last tab; Escape closes the dialog. Closing restores the launch-button focus and releases page scroll lock.
- Reduced-motion overrides and VisualViewport keyboard resizing are implemented. Physical iOS/Android keyboards and OS reduced-motion settings were not emulated. No production event writes or backend changes were made.

## Local review

Preview: `http://127.0.0.1:5184/tests/round-robin/event-browser/index.html?command`.

The `command` fixture enables score saves and round advancement in memory only; reloading resets it. Other mutations remain disabled. See the preview README for additional fixture options.

Branch: `codex/round-robin-command-center`, based on published main `3aff6308`, in `pulse-round-robin-controls-release`. This command-center change is local and has not been published. Unrelated primary-checkout edits remain untouched.
