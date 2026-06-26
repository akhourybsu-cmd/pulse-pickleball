# Round Robin Guest Players — Implementation Plan

## Overview
Add reusable guest player profiles to the Round Robin system, scoped to a creator (and optionally a community group), so the same guests can be added across multiple events. Guest-enabled events are automatically excluded from PULSE Ratings. Add an "Invite to Claim Profile" flow so guests can later link to a real account.

## 1. Database Schema (single migration)

### New table: `guest_players`
Reusable guest profiles owned by a creator, optionally scoped to a community group.
- `id`, `display_name` (required), `created_by` (uuid → auth.users), `group_id` (nullable → groups), `email`, `phone`, `skill_estimate` (numeric), `linked_user_id` (nullable → profiles), `linked_at`, `created_at`, `updated_at`.
- Index on `(created_by)`, `(group_id)`, `(linked_user_id)`.
- RLS: creator can manage their own guests; group admins can read/manage guests for their group; everyone can read guests referenced in events they can view (via existing event policies).
- GRANTs to `authenticated` + `service_role`.

### New table: `guest_claim_invites`
- `id`, `guest_player_id` (→ guest_players), `token` (unique, random), `invited_email` (nullable), `created_by`, `created_at`, `expires_at` (default now() + 30 days), `accepted_at`, `accepted_by_user_id`, `status` (`pending|accepted|revoked|expired`), `requires_approval` (bool — true for generic links, false for email-matched).
- RLS: creator can manage; anyone with the token can SELECT (via SECURITY DEFINER RPC `get_claim_invite(token)`).

### Modify `round_robin_events`
- Add `allow_guests boolean default false`.
- Add `rating_exclusion_reason text` (nullable).
- Trigger: when `allow_guests = true`, force `rating_eligible = false` and set `rating_exclusion_reason = 'Guest players enabled'`.

### Modify `round_robin_players`
- Add `guest_player_id uuid` (→ guest_players, ON DELETE CASCADE).
- Add CHECK: exactly one of `player_id` or `guest_player_id` is non-null.
- Drop the existing `(event_id, player_id)` unique key, replace with two partial unique indexes: one on `(event_id, player_id) where player_id is not null`, one on `(event_id, guest_player_id) where guest_player_id is not null`.
- Keep legacy `guest_name` for backward compat (read-only fallback); new writes use `guest_player_id`.
- Update RLS policies to allow organizer inserts where `guest_player_id` is set.

### RPCs
- `claim_guest_profile(token text)`: validates token, matches authenticated user's email when present, sets `linked_user_id` on the guest, marks invite `accepted`. If `requires_approval` is true, creates a pending claim row instead and notifies creator.
- `approve_guest_claim(invite_id)`: creator approval for generic-link claims.

## 2. Wizard Changes

### `useWizardSteps.ts`
Add `allowGuests: boolean` to `WizardFormData`. Surface it on the Ratings step (or Details). When `allowGuests=true`, force `ratingEligible=false` and show explanatory helper text.

### `RatingsStep.tsx`
- Add toggle: "Allow guest players (disables PULSE Ratings)".
- When on: disable the rating-eligible toggle, show banner "Not eligible for PULSE Ratings — Guest players enabled".

### `PlayerPickerSheet.tsx`
- Extend existing Guest tab to:
  - List the creator's existing reusable guests (and group's guests if `groupId` is set).
  - Quick-add input creates a new `guest_players` row (instead of an ephemeral object).
  - Show "Guest" badge on results; if `linked_user_id` set, resolve to the registered user.
- Only show Guest tab when `allowGuests` is true.

### `WizardContainer.tsx` save
- Persist `allow_guests` on the event.
- For each selected guest, insert into `round_robin_players` with `guest_player_id`.

## 3. Resolver / Display

Add a small helper `resolveRRParticipant(row)` returning `{ id, name, avatar_url, isGuest, linkedUserId }`. Update standings, schedule, kiosk, score-entry, and host views to use it instead of reading `player_id` directly. Existing `guest_name` rows fall back to that text.

## 4. Rating Pipeline Exclusion
- Audit `recalculate-ratings` edge function + any client-side rating writes. Skip matches whose source RR has `allow_guests = true` OR any participant has `guest_player_id`. Already-correct path: `rating_eligible=false` events shouldn't feed ratings; we'll add a defensive guard.

## 5. Invite-to-Claim Flow

### Creator UI
- In `PlayerManagementDialog` (and a new "Roster" view): for any guest participant, menu item **Invite to Claim Profile**.
  - Modal: optionally enter email → calls `send-transactional-email` with a new `guest-claim-invite` template. Generates token, stores `guest_claim_invites` row.
  - Button: **Copy share link** → `/claim-guest/:token` (sets `requires_approval=true`).

### Claim page `/claim-guest/:token`
- If not authenticated → redirect to `/auth?redirect=/claim-guest/:token`.
- After auth, calls `claim_guest_profile` RPC. Shows success or "pending creator approval".

### Email template
- New `guest-claim-invite.tsx` in `_shared/transactional-email-templates/` with claim CTA.

### Approval UI
- In `PlayerManagementDialog`, badge on guests with pending claims; creator can approve/reject.

## 6. Merge Duplicate Guests (admin)
- New action in guest list: select two guest rows → `merge_guest_players(keep_id, remove_id)` RPC: rewrites `round_robin_players.guest_player_id`, then deletes loser. Creator/group-admin only.

## 7. UI Helper Text
- Wizard Ratings step: "Guests are great for casual or open play, but events with guests don't count toward PULSE Ratings."
- Event header: badge "Not Rating Eligible — Guests Enabled" when applicable.

## Out of Scope (deferred)
- Bulk import of guests from CSV.
- Guest stats/standings displayed publicly on profile pages (until linked).
- Push notifications when a claim is approved (basic in-app notification only).

## Technical Notes
- All schema in one approved migration.
- New edge functions: none required beyond the existing `send-transactional-email`.
- Tests: rely on TS typecheck + manual QA in the wizard and kiosk.
