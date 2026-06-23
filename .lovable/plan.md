
# Community Push Notifications — Infrastructure Pass

Scope: web push / PWA only (no native Capacitor push). Goal: make sure every meaningful Community event reliably triggers a push to opted-in members, with a clear opt-in moment when they first open a group.

## What's already in place (verified)

- VAPID keys configured (`VITE_VAPID_PUBLIC_KEY` set; server-side `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` used by `push-send`).
- Service worker `public/sw.js` handles `push` events and renders the notification.
- `usePushSubscription` hook subscribes the browser and stores rows in `push_subscriptions`.
- DB triggers already exist on `group_posts` → `notify_group_post_created` and on `group_post_comments` → `notify_post_comment`. Both write to `user_notifications`.
- An `AFTER INSERT` trigger on `user_notifications` calls `dispatch_push_for_notification`, which `pg_net` posts to the `push-send` edge function — so any new row in `user_notifications` already fans out as a web push.
- Per-group prefs table `group_notification_prefs` + `is_group_channel_enabled()` already gate post/announcement pushes.

So the pipeline works end-to-end today for **new group posts**. The pass below closes the remaining gaps the user asked about.

## Gaps to fix

1. New comments on a post I authored → in-app notification exists, but title/body are generic ("New Comment"). Tighten copy and deep-link so the push opens directly to the post + comment.
2. Replies on a comment thread I'm part of → not currently notified at all.
3. @mentions in posts/comments → not currently notified at all.
4. Announcements / pinned posts → trigger exists and uses `priority='high'`, but the push payload doesn't surface that as a high-urgency notification (it's normal urgency in `push-send`). Confirm `high` is honored and the SW renders with `requireInteraction: true`.
5. First-visit opt-in inside a group → today the `EnablePushBanner` only lives on the Dashboard. Add it to `GroupDetail` (dismissible, 7-day TTL, hidden once `state === "enabled"`).
6. Stale subscriptions / multiple devices: `push-send` already prunes 404/410. Confirm we upsert on `endpoint` (we do) so re-subscribing on the same device doesn't duplicate.
7. iOS PWA caveat: surface a one-line hint in the banner when iOS Safari is detected and the app isn't installed to home screen (logic already exists in `EnablePushBanner` — reuse).

## Implementation

### A. Database migration (one migration)

- `notify_post_comment` (existing): rewrite copy to `"<name> replied on your post in <group>"`, set category `community`, include `group_id` in metadata, and gate via `is_group_channel_enabled(..., 'posts')` so a fully-muted group also mutes comment pings.
- New trigger `notify_comment_reply` on `group_post_comments`: when `parent_comment_id IS NOT NULL`, notify the parent comment's author (skip if it's the same user as the post author already notified, skip self-replies).
- New trigger `notify_mentions` on `group_posts` and `group_post_comments`: parse `@handle` tokens from `content`, resolve to `profiles.id` via `display_name` / `username`, fan out one notification per mentioned user (deduped against post author / commenter to avoid double pings). Channel = `posts`, priority = `normal`.
- Confirm `notify_group_post_created` already covers announcements; no schema change needed there.

### B. Edge function (`supabase/functions/push-send/index.ts`)

- Already accepts `priority`. Map `priority === "high"` to `urgency: "high"` (already done) AND include `requireInteraction: true` in the JSON payload so the SW can render it stickier.
- No new function — reuse `push-send`.

### C. Service worker (`public/sw.js`)

- Read `requireInteraction` from payload; pass through to `showNotification` options.
- Set `tag` per notification type so successive posts in the same group collapse rather than stack endlessly.
- Add `notificationclick` focus-or-open behavior for the `url` field (verify it exists; patch if missing).

### D. Frontend

- `src/pages/player/GroupDetail.tsx`: render `<EnablePushBanner />` at the top of the feed, only when the user is a member, push state ∈ {`disabled`, `denied`}, and not dismissed (reuse the existing 7-day localStorage TTL — namespace the key per group so dismissing one group doesn't hide it forever everywhere).
- Group settings sheet: confirm the per-group "Posts / Announcements / Chat / Mute all" toggles are wired to `set_group_notification_pref` (they are via `useGroupSettings` / `group_notification_prefs`). Add a small "Send me a test push" button in `/settings/notifications` that calls `push-send` for the current user — useful for QA on a phone.

### E. QA

- Trigger a post from user A in a group, verify user B (subscribed, not muted) gets push.
- Mute group for user B, repeat — no push.
- Comment on user A's post as user B → user A pushed.
- Reply to user B's comment as user C → user B pushed, user A not double-pushed.
- Pin/announcement post → high-priority push delivered even when "posts" channel is off, as long as `announcements` is on.

## Technical notes

- All DB changes ship in one migration with `CREATE OR REPLACE FUNCTION` + `DROP TRIGGER IF EXISTS` / `CREATE TRIGGER` (idempotent).
- No new tables, so no GRANT block needed.
- No new secrets; `VAPID_*` and `push_dispatch_secret` already configured.
- Mention parser uses regex `@([a-zA-Z0-9_\.]{2,30})` against `profiles.display_name` (case-insensitive). False positives are harmless — the lookup just returns no row.
- `push-send` stays internal (dispatch secret); never call it directly from the client except via the "Send test push" button which goes through the existing `send-test-push` function.

## Out of scope (per your answers)

- Native Capacitor push (FCM/APNs).
- Reaction notifications.
- Email digests for community activity.
