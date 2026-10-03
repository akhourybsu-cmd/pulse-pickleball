# Round-robin controls review — October 3, 2026

Reviewed setup, start, court/game configuration, schedule generation and repair, player/guest addition and removal, waitlist/registration, current-round and future substitutions, manual partner/opponent/court changes, scoring, correction, round advancement, completion, sharing, kiosk/player views, and event cancellation/deletion.

## Findings and fixes

| Control | Finding | Change |
| --- | --- | --- |
| Start | An unguarded update could restart a live event at round one after a delayed retry. | Event-locked start RPC validates the saved rotation against active registrations and returns the existing live round on retry. |
| Void/delete result | Separate browser writes ignored some errors, left standings counting voided scores, and could partially delete history. | One authorized transaction updates history, schedule, stats and audit. Stale scores are rejected; retries do not repeat effects. Admin-only deletion leaves a resolved court. |
| Event settings/location | Updates and audit were separate; failed saves could close the dialog. | Versioned settings RPC with field validation and atomic auditing. Errors remain visible and drafts survive refresh. |
| Registration deadline | UTC text was displayed in a local-time input; clearing the field did not save null. | Local-time rendering and explicit clearing, with regression tests in America/New_York. |
| Rating rules | Correcting an old score could apply the event's newly changed eligibility to that result. Reading a completed event could initiate rating recalculation. | Existing results retain their saved policy; future results use new settings. Reads have no rating side effects. |
| Manual schedule editor | Equivalent refreshes reset selections; failed callbacks escaped the UI. | Stable round selection, preserved inputs, visible retryable failures and submission guards. |
| Score menu | Completed events offered entry for unplayed matches; fractional values were silently truncated. | Completed-event correction choices reflect server rules; whole-number validation preserves invalid values for correction. |
| Resolved play | Voided/removed results could appear as completed wins or upcoming assignments. | Host, player and kiosk cards explain resolved courts; standings and player instructions exclude those results. |
| Cancel/delete event | Event-level mutations did not serialize with other host controls. | Shared event lock, explicit authorization/MFA checks, history-safe cancellation and admin-only deletion of scored events. |

## Verification

- Isolated PostgreSQL (PGlite) executes the production SQL functions, rating/stat triggers, guest identity guards and claimed-guest participant mapping. Tests run new controls as the authenticated role.
- Database controls cover stale starts, missing rounds/players, incomplete and duplicate seats, role/MFA restrictions, mixed teams, partner/opponent/court changes, replayed requests, score removal, admin deletion, policy preservation, and all-results-voided completion.
- Forced audit failures verify full rollback of event state, scores, player statistics and ratings.
- The existing 22-player lifecycle simulation now loads the new control migration and latest guest triggers. It still replaces two players in round three, removes two departures, plays subsequent rounds and reconciles all match history.
- Existing registration/sharing, waitlist, roster replacement/removal, equal-games, score lifecycle, kiosk, performance and guest lifecycle suites remain in the regression pass.
- Browser fixture checks: start transitions to round-one scoring; settings failure preserves the typed name and succeeds on retry; live rounds remain locked; failed partner rotation preserves the selected court and succeeds on retry; failed void stays open, then retry updates the court label and standings. Mobile settings checked at 390 × 844 and viewport restored.
- Fixtures are entirely local and use no production requests. No live round-robin data was changed for this review.

Production deployment is gated by TypeScript, the full repository test suite, production build, backend checks and live asset verification. CI/deployment evidence is linked from the pull request.

Performance boundary: retroactive ranked-result corrections still replay rating history to preserve later results. This review removes an unnecessary read-time replay and duplicate replay when deleting an already-voided round-robin result; it does not claim database production latency from local fixtures.
