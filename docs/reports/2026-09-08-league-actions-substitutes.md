# League Actions and substitute requests

## Implemented

- Management opens on **Actions**, with a compact header so decisions are near
  the top on mobile. Existing `?tab=` links still work. Other sections show a
  pending-action banner linking back to the inbox.
- The inbox reads actual pending sub requests, season player approvals, disputed
  matches and submitted scores across seasons. It shows errors/retry rather than
  treating failed reads as zero tasks. New leagues get a season-setup shortcut.
- Score-review links retain the correct season and open the review filter.
  Pending season members are pinned above the normal roster with approval controls.
- Shared substitute review is available from Actions, the Substitutes bench and
  Ladder & weeks. Removed duplicate inline one-click resolution implementations.
- Managers search eligible fill-ins, review scheduling consequences, add a
  separate message, then confirm. Current ladder players, other assignments and
  reported absences are excluded. Reopening a resolved arrangement is explicit,
  removes the old arrangement and returns it to the pending queue. Closed/past
  undrawn pending requests can be canceled from review.
- Player requests show week/date, request status, the arranged substitute and the
  organizer message. Pending requests can be canceled; resolved coverage requires
  organizer coordination. Request forms explain that submitting is not a guarantee
  of coverage. Season/user changes reset the form; query keys isolate each viewer.
- Realtime/focus/reconnect/60-second fallback refresh now includes request,
  sit-out and batch changes. Open manager request reviews refresh too.
- Kept the prior local Manrope/Sora and cream/ink/gold pass. Extended heading and
  portalled option/menu-item coverage, fixed the nested organizer skill-card dialog,
  raised tiny labels in the main league menus, and made narrow dialog headers less
  cramped. Forms remain viewport-bounded with persistent footers.

## Database migration

Complete, standalone copy/paste SQL:
`supabase/migrations/20260916100000_league_sub_request_workflow.sql`

Adds `resolution_note`; replaces request, resolve and cancellation RPCs; adds
explicit manager reopening and a pending-request draw guard. Preserves the
player's note, authorizes each actor, restricts anonymous execution, serializes
decisions/cancellation/draw on the session row, prevents retry-overwrites and
same-week double bookings, audits changes, and notifies the owner/active assistant
managers or requesting player with season-aware links.

The SQL was applied **before** publishing the frontend. The UI uses the new reopen
RPC and relies on the new decision guards. Reapplying the migration is covered by
tests. Production backend run `34291131911` applied this migration successfully:
427 local migrations, 426 previously recorded, exactly one pending and applied.

## Verification

- Final full suite: **804 passed**, 32 skipped, 10 todo (62 passing test files).
- Production build passed (4669 modules, final build 42.55s).
- League tests: 22 new SQL/eligibility checks, including retry/cancel/resolve,
  assistant permissions, fill-in conflicts, notes, reopening, notifications and
  draw guards. Runs the production migration twice against PGlite fixtures, with
  authenticated/anonymous roles and a recording notification stub.
- Seven additional rendering checks cover decision messaging, labeled controls,
  search/no-candidate states, failed reads vs. all-clear, and new-season guidance.
- Existing presentation/keyboard tests continue to pass.
- Repository TypeScript checking still fails on preexisting unrelated errors;
  the final focused output contained no league or organizer skill-card diagnostics.
- Confirmed old font names and dev-only preview strings are absent from `dist`.
- Browser QA used real Actions/decision-field/form/nav components with synthetic
  data: 390x844 mobile Actions, 320x568 decision form, 1440x900 dark-mode review.
  At 320x568 the settled dialog measured x=16, y=16, width=288, height=536;
  no horizontal page overflow. Computed fonts were Sora headings and Manrope
  controls; mobile inputs 16px, decision/footer/close targets at least 44px.
- Verified search narrows the fill-ins, selection enables confirmation, keyboard
  ArrowRight selects Sit out, and the 31-player foursome warning appears. These
  preview confirmations are synthetic and do not write to Supabase.
- Local authenticated management redirected to `/auth`. A signed-in, live-data
  end-to-end check remains after migration/deployment; no live league records
  were changed. Viewport and preview theme were restored after QA.

## Release state

Backend commit `c45280ad` was pushed to main and its migration was applied to
production on 2026-09-08. Frontend publication is in progress with the previously
verified league typography pass included. The three unrelated Android Gradle
changes remain excluded.
The preview is development-only: `http://127.0.0.1:8080/__league-preview`.
