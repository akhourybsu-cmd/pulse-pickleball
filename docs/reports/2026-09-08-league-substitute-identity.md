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

Local changes only; not committed, pushed or deployed in this pass. No SQL
migration is required: existing match-slot substitution records are reused.
No live league memberships, requests, matches, results or notifications were
created or changed. A production two-user request/swap smoke test remains after
publication; this pass does not claim that live mutation cycle was performed.
The three preexisting Android Gradle edits remain untouched and must be excluded
from any league-only commit.
