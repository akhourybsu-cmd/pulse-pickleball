# League operations verification — September 8, 2026

## Scope and results

Organizer and member workflows were inspected end to end. This pass fixes season context, enrollment, organizer permissions, scoring integrity, data loading, substitutions, and responsive forms. It does not rewrite existing membership history, schedules, scores, or ratings.

- `npm test`: **692 passed**, 32 skipped, 10 todo; 51 passing test files, 3 skipped.
- Focused league coverage: **123 passing tests** (41 real PostgreSQL integration checks, 37 operations/standings checks, 6 data-loading checks, and 39 existing ladder-engine checks).
- `npm run build`: successful. Existing bundle-size, Browserslist-age, and CSS-class warnings remain.
- Changed-file lint: no errors. The broader leagues directory retains an existing AuditLogTab dependency warning.
- The full application TypeScript check still reports existing errors outside this league pass, including venue, tournament, round-robin, and shared profile types. It is not a clean repository-wide type-check gate.

## Behavior verified

| Area | Changes / evidence |
| --- | --- |
| Organizer permissions | Owners and active assistant managers can operate the console. Ordinary members cannot edit league settings or promote themselves. Removing an assistant revokes management. Assistants cannot transfer ownership. PostgreSQL RLS tests cover these boundaries. |
| Season enrollment | Invite joins are serialized, case-insensitive, and idempotent. Joining a new season adds a new membership instead of moving the previous season's record. Removed/pending memberships cannot bypass organizer approval. Deadlines and active-season requirements are enforced server-side. |
| Season selection | The default is the active season, ahead of newer drafts. Explicit historical season links are preserved. Organizer tabs share the `season` query parameter. Multiple memberships no longer break the player's league view or produce duplicate league cards. |
| Scheduling | Court numbers, session scope, unique player slots, score pairs, dates, and time ranges are validated. Reducing courts cannot strand open matches. Draft sessions and their games remain private until publication. |
| Scores | Removed players cannot score using stale slots. Exact match start times take precedence over session start. Disputes require organizer resolution. Confirmations include the score the player actually saw and reject concurrent changes. Organizer score corrections clear stale confirmations. |
| Standings | Verified results count; unconfirmed/disputed scores do not. Seasons are separated. Team forfeits require a participating winner and do not invent points. |
| Ladder lifecycle | Production first-batch and finalize procedures run in isolated PostgreSQL tests. First generation is idempotent. Processing rejects unconfirmed results. Inactive/draft seasons cannot start or advance. Closing a season requires finished games and processed batches, completes its ladder, and disables auto-advance. |
| Lifecycle sync | Eligible seasons can advance while unfinished expired seasons remain open. The UI reports how many require attention instead of claiming everything is synchronized. |
| Substitutes | Active fill-ins can see and score assigned published games without ordinary membership. Their league appears in the hub/dashboard with a Substitute label. Substitute loading is season-scoped and failure-aware. |
| Teams and roster | Re-adding a removed team member uses an upsert instead of violating the unique roster constraint. Pending memberships have an explicit Approve action. Update actions verify that a row was actually changed. |
| Long seasons / refresh | Main league datasets paginate beyond the API cap; profile and related-ID lookups are chunked. Failed pages reject the incomplete dataset. Account/season query keys prevent stale cross-context results. Live/focus/online refresh and a foreground fallback keep views current without remounting open forms on each refresh. |
| Mobile and desktop | Forms use bounded, scrollable bodies and fixed action areas. Date fields and side assignments stack on narrow screens. Season selectors remain readable. Mobile standings retain name, wins, losses, and differential without clipping; wider screens add games played, win percentage, and form. Long hero values use readable text rather than oversized numerals. |

## Browser checks

- Read-only production inspection used the existing `SIM — Ladder 5W · 2026-07-28` league; its organizer console and member-facing page loaded. No live membership, schedule, score, or rating was changed for testing.
- A separate browser harness uses the actual components with fictional ELEVENO data and an in-memory backend. It is not connected to Supabase. It is excluded from the normal application entry and production build.
- The harness exercised existing-season form prefill, an invalid end-date rejection, navigation, member standings/team/match sections, and Save & next moving from Court 1 to Court 2 with the next match's time and score.
- Phone fixtures use actual 390px and 320px iframes, not an unverified viewport override. At 320px the final member page had no horizontal overflow. The match dialog stayed within x=16–304 and y=16–828 in its 320×844 viewport; controls stayed inside it.
- Browser automation's programmatic date fill did not trigger React's change event; a real keyboard increment did. Validation was verified using that keyboard interaction, not a false successful fill.

To reproduce the isolated browser review:

```sh
npm run dev -- --config tests/leagues/browser/vite.config.ts --host 127.0.0.1 --port 8081 --strictPort
```

Open `/tests/leagues/browser/index.html` for desktop, or `/tests/leagues/browser/phone.html` for phone frames. Fixture changes disappear on reload. The mock is for layout/input behavior, not an RLS or edge-function substitute; those assertions live in `tests/leagues/operations.test.ts`.

## Deliberate boundaries / follow-up

- A two-person, two-device production playthrough (join → play → confirm/dispute → organizer resolution) remains a useful final acceptance check. Automated database tests cover the roles, but do not prove push delivery or every device/network condition.
- Eligibility settings remain explicitly a preview/advisory feature. This pass does not silently turn saved preview rules into enrollment restrictions.
- Guests still need an actual PULSE account to enroll or report scores. Unregistered guest creation and payments were not added.
- Legacy session date/time fields retain their existing UTC interpretation in scoring gates. This pass does not guess and convert previously entered session times. A league timezone setting and legacy-data review should be a separate change.
- Singles/flex use individual standings; doubles/team use team standings. The existing forfeit workflow requires teams; individual forfeits and alternate cancellation/ranking policies are not newly implemented here.

## Deployment and full SQL

Deploy the backend before the frontend, because the frontend uses `confirm_league_match_score`.

The complete, copy/paste migration is [20260914100000_league_operational_integrity.sql](../supabase/migrations/20260914100000_league_operational_integrity.sql). It includes its transaction and can be opened/copied as a whole; no hidden SQL steps are required. The migration was also applied twice in isolated tests to check repeatability.

The repository's approved main-branch workflows applied the migration/edge functions to Supabase and published the frontend to Firebase Hosting, in that order:

- Backend commit `2623a702`: [Deploy Supabase #103 — successful](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34186721657).
- Frontend commit `c2a60e40`: [Deploy frontend #13 — successful](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34186897989).
- After release, the production organizer overview showed the updated guidance; the seasons panel loaded its real aggregate counts; the substitute bench loaded its six existing fill-ins; the member-facing page loaded published sessions and all 32 standings entries. No browser runtime errors were observed in these checks. No live records were changed for verification.

## Follow-up: second-batch activation error

The September 8, 06:31:42 EDT `ladder-generate-next` request returned HTTP 400. Supabase's PostgreSQL log at the same timestamp recorded SQLSTATE `22023`: “Activate the league and season before starting or advancing its ladder.” This was a lifecycle rejection, not an authentication or connectivity failure. The league being tested has not been identified by the user, so no live status was changed.

- The Ladder tab now explains inactive league and season statuses separately, with working links to Overview and Seasons. Starting/generating and automatic advancement are disabled while either is inactive; preparation and existing results stay accessible.
- Non-2xx function responses are decoded from Supabase's response body. The actual explanation appears in the toast, structured tiebreak payloads survive, and the progress bar no longer reports a failed request as successful. Busy state also clears on a rejected invocation.
- Isolated PostgreSQL coverage now runs the production generic generation procedure after finalizing batch 1. Batch 2 is generated exactly once, uses the same session, and leaves the first batch's verified results unchanged.
- Verification: **708 tests passed**, 32 skipped, 10 todo. Production build passed. Changed-source lint passed. Full app type-check retains the previously documented unrelated errors, with none in the changed league files.
- Browser fixtures verified the inactive warning and disabled Generate Batch 2 button at 390px and 320px, navigation to Seasons, the enabled button when both statuses are Active, and a simulated HTTP 400 displaying the exact database explanation. This was an isolated in-memory fixture, not live generation.
- No SQL migration or backend deployment is required. Existing production scores, schedules, standings, and statuses were not changed. To proceed in an intended running league, its organizer must set both the league (Overview) and selected season (Seasons → Edit) to Active and save.

Reproduce browser cases with `phone.html?ladder=1` (inactive) or `index.html?ladder=1&active=1` (active with simulated server rejection) under the isolated QA server above.
