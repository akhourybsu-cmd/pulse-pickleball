# League substitute names and presentation

## Root cause

`useLadder` fetched profiles only for active season members and the latest ladder
snapshot. Temporary substitutes are intentionally absent from that snapshot, so
their actual match-slot IDs fell back to eight-character UUID prefixes. The team
roster editor also relied only on parent profiles, which could omit inactive or
off-roster substitutes. The edit-sub form lacked the person's name, and resolved
request reviews did not show the assigned fill-in.

## Changes

- Hydrate ladder names after reading game slots, court groups, substitution
  records, bench players and historical movements. Team roster dialogs hydrate
  their own roster profiles. Missing names explicitly say `Name unavailable`,
  never a shortened account ID or an unsupported claim that the user was deleted.
- Shared `LeaguePlayerName` uses an italic name plus a visible `Sub` badge.
  Bench rows, selected fill-ins, arrangements, team substitutes, actual match
  participants and individual standings use the same presentation. Plain-text
  selects and score confirmations use `(Sub)`.
- Match status comes from `league_match_substitutions`, checked against the
  actual current slot. Being on the bench alone does not mark all of someone's
  games as substitute appearances; stale/restored assignments do not get badges.
- Court headers and the player's week card use actual game participants, not
  merely the underlying ladder seats. Partial coverage retains both people who
  played. A fill-in can find their court without having a permanent ladder seat.
- Existing resolved requests show the named arrangement and notes. Post-draw
  requests are explicitly historical; match slots are the current source of
  truth after a later swap. Week rosters show assigned coverage next to the regular.
- Edit, remove and status controls identify the person. Bench buttons are at
  least 44px; searches discard stale responses and distinguish errors/loading
  from no matches. Season changes close stale bench dialogs.
- Swap previews show the actual earliest batch and correct game count. Missing
  batch metadata fails closed, and incoming players already scheduled in that
  scope are disabled. Non-ladder scope is explicitly all unplayed season games.
- Activity entries include named substitute/outgoing-player summaries while
  retaining technical audit details separately. Profile read errors are surfaced.
- Mobile court scoring has a separate score row, giving long names room to wrap.
  Organizer match rows move court/status metadata away from the narrow name area.
- Standings still credit the person who played; the badge legend explains that
  substitute appearances do not transfer results to the absent regular.
- Added substitution-change refresh and season/viewer-keyed player week queries.

## Verification

- 17 new identity/presentation/scope tests; 104 league tests pass.
- Full suite: 821 passed, 32 skipped, 10 todo.
- Final production build passed (34.12s). Existing shared/large-chunk and
  Browserslist warnings remain.
- Focused TypeScript check returned no diagnostics in changed league surfaces.
  Repository-wide checking still fails on unrelated preexisting errors.
- Browser QA used real shared name, scorecard, standings and decision components
  with synthetic data. Verified 1280px desktop, 390px mobile, and 320x568 narrow
  mobile; long names wrap, Manrope italic is used, badges stay visible, and no
  horizontal document overflow was observed.
- At 320x568 the request dialog measured x=16, y=16, width=288, height=536.
  Searching Jordan narrowed the choices; selecting Jordan Chen enabled preview
  confirmation. Preview scoring is explicitly read-only and cannot save scores.
- No browser errors were recorded. The viewport override was reset.

## Release state

Published to main as `8039513088f7ceac5b30378726abaf488754c5de` and deployed
successfully to Firebase Hosting in workflow run
[34301876021](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/34301876021).
CI independently passed all 821 tests (32 skipped, 10 todo), the production
build, and deployment on September 8, 2026 (America/New_York).

Post-deployment read-only checks on pulsepb.com verified:

- The substitute bench shows actual names and explicit Sub badges.
- The edit dialog identifies Hugo Sub4 by name, with italic styling.
- Ben L28's existing arrangement identifies Layla Sub1 as the substitute and
  clearly distinguishes the original pre-draw arrangement from current matches.
- Week 2 court headers and game rows show Layla Sub1 and Finn Sub2, with Sub
  badges and computed Manrope italic styling. Regular ladder seats remain intact.
- No horizontal document overflow or browser warnings/errors appeared during
  these live checks.

No SQL migration is required: existing match-slot substitution records are reused.
No live league memberships, requests, matches, results or notifications were
created or changed. A production two-user request/swap mutation smoke test was
not performed; the live verification above was read-only. The simulation league
was already archived when inspected, and its status was not changed.
The three preexisting Android Gradle edits remain untouched and were excluded
from the league release.
