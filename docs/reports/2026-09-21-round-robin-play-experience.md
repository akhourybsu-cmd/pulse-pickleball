# Round Robin play experience refinement

## Scope

The creation studio now uses the viewport as its frame. The header, progress navigation, and Continue/Back controls stay in place while long steps scroll inside the workspace. Desktop retains the step list and live event ticket; mobile retains the All steps sheet. Selections, progress, and step changes have brief PULSE feedback with reduced-motion overrides. Existing form validation, review editing, and event creation handlers remain in place.

The player page opens on **Your court**. A compact event header and four tabs lead to a court-style matchup with the current court, teams, recorded score when present, and the next saved assignment. The next round remains explicitly contingent on the host advancing play. Schedule, players, standings, event information, and host notes remain accessible. Rest, unassigned, unscheduled draft, completed, and voided states have their own guidance.

Player data refreshes after event, schedule, or roster realtime changes and when returning to the app. Refresh requests are debounced and serialized; background updates retain the selected tab. This adds read subscriptions, not write operations.

Organizer identity and primary-action layouts are more compact, with a round-results progress bar and restrained transitions. Complete Event remains wired to its existing handler and now sits below the matches. Scoring, permissions, scheduling, and standings calculations are unchanged.

## Verified

- 18 Round Robin test files / 177 tests passed, including six new assignment tests for current vs. upcoming rounds, completed results, byes, linked guest identities, unassigned viewers, and preserving schedule order.
- Production build passed in 72 seconds. Existing bundle-size warnings remain.
- Focused ESLint passed for the new helper/tests, briefing, tabs, action banner, and edited shared wizard components. The wider project has existing lint/type debt.
- Final TypeScript check reported no diagnostics in the edited files; existing project errors remain in unrelated files.
- Browser fixtures: creation at 390 × 844 and 375 × 667, desktop at 1440 × 900. The document stays at viewport height and long step content scrolls within the form.
- Walked all nine creation steps, including roster selection and Done, count setup, custom-games control, future-date calendar, rating options, group selection, review editing, Return to review, and All steps navigation. Final event creation was not submitted.
- Player screen at 390 × 844, 375 × 667, and 1440 × 900; light and dark views inspected. At 375 × 667 the normal/recorded-result assignment fits without panel scrolling, including an 11–0 score. Long event/player names wrap and retain scrolling when needed.
- Checked playing, rest, recorded-result, completed, voided, and unscheduled-draft states. Full schedule and standings actions work; Radix Home/End keyboard navigation remains linked to the panels.
- A local fixture simulates host advancement: the rest-round card updates to Round 3 and its new partner without reload. A second check retains Standings during the same update and shows the new assignment when returning to Your court.
- Desktop and mobile organizer controls open, court settings open/close, and no horizontal document overflow was observed at 390px.
- Reduced-motion behavior is implemented through existing Framer settings and CSS media rules; an OS-level reduced-motion setting was not emulated in this browser session.

## Preview and release state

- Creation: `http://127.0.0.1:5185/tests/round-robin/browser/index.html`
- Organizer: `http://127.0.0.1:5184/tests/round-robin/event-browser/index.html`
- Player: `http://127.0.0.1:5184/tests/round-robin/event-browser/index.html?player`
- Player fixture options: `rest`, `scored`, `longnames`, `completed`, `voided`, `draft&empty`, and `simulate`. `simulate` adds an explicit local Advance preview round button. These pages use fixtures and do not submit production changes.

Branch: `codex/round-robin-play-experience`, in `pulse-round-robin-controls-release`. It starts from the prepared batch-add correction `61dc78b7`, which remains unpublished. Unrelated development-checkout edits are preserved.

This refinement is local only. No publication or production event mutation was performed. Live realtime delivery and a real event save still require verification after deployment.
