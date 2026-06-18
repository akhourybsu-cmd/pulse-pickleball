## Goal

Let users post Round Robins (RR) to their Community Groups, with two clear modes:

1. **Private to a group** — only members of the chosen group can see and join the RR (no public discovery).
2. **Shared/Advertised to a group** — RR is published publicly AND auto-posted to the chosen group's feed, so members can sign up with one tap and share the link.

Only users who are `owner` or `moderator` (group admin) of a group can post a RR to that group.

## UX Flow (Create Round Robin Wizard)

Add one new step near the end of the wizard, after `EventModeStep` and before `ReviewStep`:

**Step: "Where should this Round Robin live?"** — three cards:

```text
┌─────────────────────────────────────────┐
│  Just me / friends I add manually       │  ← default (current behavior)
│  Invite-only, no group post             │
├─────────────────────────────────────────┤
│  Private to a group                     │
│  → pick from groups I admin             │
│  Only group members can see & join      │
├─────────────────────────────────────────┤
│  Share to a group (recommended)         │
│  → pick from groups I admin             │
│  Auto-posts to group feed + public link │
└─────────────────────────────────────────┘
```

If the user has zero admin groups, the two group options show "Create a group first" and link to `/player/community`.

The `ReviewStep` shows the selected group and visibility, with a "Change" link back to the new step.

On submit:
- Save RR with new `group_id` + `group_visibility` columns.
- If "Share to a group": insert a `group_posts` row of new `type='round_robin'` linking back to the RR, pinned for 24h, with title/date/court count/CTA "Join Round Robin".

## Group Feed Card

In `useGroupPosts` and the group post renderer, add a new post type `round_robin`:
- Card shows RR name, date/time, location, players-joined/max, "Join Round Robin" button → `/round-robin/join/:invite_code` (existing flow).
- Live-updates participant count via existing `round_robin_players` realtime subscription.
- Admin overflow menu: "Unpin", "Remove post" (does not delete the RR itself).

## Group Detail Page

Add a small "Upcoming Round Robins" rail above the feed on `GroupDetail.tsx` that lists RRs where `group_id = this group`. Admins see a "+ New Round Robin" button that opens the wizard pre-seeded with this group selected.

## Permissions & Visibility

- New RR RLS policies:
  - `group_visibility = 'private_group'` → only active members of `group_id` can `SELECT`.
  - `group_visibility = 'shared_group'` → public discovery as today, plus group members get it in their feed.
  - `group_visibility = 'personal'` → current invite-only behavior, unchanged.
- Insert policy: when `group_id IS NOT NULL`, the organizer must be group admin (`is_group_admin(auth.uid(), group_id)`).
- `delete_round_robin_event` + existing host policies unchanged.

## Technical Details

**Migration** (one file):
- `ALTER TABLE round_robin_events ADD COLUMN group_id uuid REFERENCES groups(id) ON DELETE SET NULL`.
- `ALTER TABLE round_robin_events ADD COLUMN group_visibility text NOT NULL DEFAULT 'personal' CHECK (group_visibility IN ('personal','private_group','shared_group'))`.
- Index on `(group_id, date)`.
- New/updated RLS SELECT policy on `round_robin_events` using `is_group_member()` for `private_group` and combining with existing public discovery for `shared_group`.
- New RLS INSERT/UPDATE check: if `group_id IS NOT NULL` then `is_group_admin(auth.uid(), group_id)`.
- Add `'round_robin'` to allowed values for `group_posts.type` (drop+recreate CHECK constraint).
- `ALTER TABLE group_posts ADD COLUMN round_robin_event_id uuid REFERENCES round_robin_events(id) ON DELETE CASCADE` (nullable).

**Frontend files to add/edit:**
- New: `src/components/round-robin/wizard/steps/GroupShareStep.tsx`.
- New: `src/components/community/posts/RoundRobinPostCard.tsx`.
- New: `src/components/groups/GroupRoundRobinsRail.tsx`.
- New hook: `src/hooks/useAdminGroups.ts` (filters `useGroups().myGroups` by `role in ('owner','moderator')`).
- Edit: `src/components/round-robin/wizard/WizardContainer.tsx` to insert the step + persist `group_id`/`group_visibility`, and to insert the group post on success.
- Edit: `src/hooks/useGroupPosts.ts` + `src/types/groupSettings.ts` to recognize `round_robin` type and join the RR row.
- Edit: `src/pages/player/GroupDetail.tsx` to render the new rail.
- Edit: `src/hooks/useVenueRoundRobins.ts` / `useGroups`-driven lists if needed for filtering.

Out of scope: paid registration, cross-group sharing, venue-mode posting changes.