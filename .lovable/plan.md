
## Focused audit: League invite & join

Reviewed every step of the join flow end-to-end. The system is largely sound — `join_league_by_code` is SECURITY DEFINER with a `FOR UPDATE` lock to prevent double-inserts, `find_league_by_invite_code` returns the teaser with `registration_open` / `registration_closes_at`, `AuthGuard` preserves `?join=CODE` through the `/auth` bounce via `returnTo`, and OAuth stashes the destination in `localStorage` so social sign-in returns to the right URL. The RPCs are case-insensitive, admin_only leagues are excluded, and the `?join=` param is stripped after consumption so refreshes don't re-fire.

Four real defects and two hardening items came out of the review.

### Defects to fix

1. **`prefillCode` is sticky in `PlayerLeagues.tsx`.** After the deep-linked dialog is closed, `prefillCode` state stays set to the old code. If the player opens the dialog again via the "Join with code" button, `JoinByCodeDialog` auto-runs a lookup against the stale code and shows the previous teaser — confusing. Clear `prefillCode` when the dialog closes.

2. **Reactivation branch of `join_league_by_code` does not update `season_id`.** A member removed by the admin and then rejoining via code gets reactivated against whatever `season_id` they had before — often an old/completed season — so they don't appear in the current season's Members/Teams/Matches tabs. Update the reactivation path to also set `season_id` to the current active season (same resolution logic already used on first-join).

3. **DATE fields parsed as local dates.** `registration_closes_at` comes back as `"YYYY-MM-DD"` and `new Date("YYYY-MM-DD")` is UTC-midnight, so users west of UTC see the deadline as the day before. Parse as a local date in `JoinByCodeDialog` when rendering the "Registration closes …" line.

4. **Invite code silently useless on `admin_only` leagues.** `InviteCodeCard` allows saving a code on an admin_only league and shows a subtle warning, but the DB accepts it and every join RPC ignores it. Block save with a clear toast when visibility is admin_only (kept as UI-side guard — DB constraint would be a bigger change).

### Hardening

5. **Better error copy for the two RPC error codes.** Map `02000` → "No league matches that code" and `22023` → "Registration for this league has closed" in `JoinByCodeDialog`'s `join()` catch, instead of surfacing the raw Postgres message. Lookup path already does this well; the join path currently just `toast.error(error.message)`.

6. **Guard against a fast double-tap join.** `handleJoin` in `JoinGroupDialog` gates on `loading`, but `JoinByCodeDialog.join()` sets `joining` after the RPC starts and doesn't disable on the Enter key. Add an early-return if `joining` is already true.

### Not changing

- Rate limiting: RR/group RPCs are throttled; league RPCs aren't. Skipping unless we see abuse — the join RPC is idempotent and gated on auth.
- `useMyLeagues` refresh after join: not needed. Successful join navigates straight to `/player/leagues/:id`, and returning to the list remounts the hook.
- Share link origin (`window.location.origin` vs canonical `pulsepb.com`): out of scope for this pass; would need env/product decision.

### Files touched

- `src/pages/player/PlayerLeagues.tsx` — clear `prefillCode` on dialog close.
- `src/components/leagues/JoinByCodeDialog.tsx` — local-date parse for `registration_closes_at`; friendlier join-error mapping; double-tap guard.
- `src/components/admin/leagues/InviteCodeCard.tsx` — block save on admin_only leagues with a toast.
- `supabase/migrations/<new>_join_league_by_code_reactivate_season.sql` — new migration replacing `join_league_by_code` so the reactivation branch also updates `season_id` to the currently-active season.

### Verification

- Typecheck.
- SQL sanity: pick an existing removed member row, call `join_league_by_code` with the league's code, confirm the row is `status='active'` AND `season_id` = current active season.
- Manual: sign out → click a `/player/leagues?join=CODE` link → confirm `/auth` bounce returns to the dialog with teaser preloaded; close the dialog and reopen → confirm it opens empty, not with the old code.
