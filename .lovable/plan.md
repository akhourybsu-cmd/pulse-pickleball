## Goal
Add backend notification triggers (in-app + push) for **community**, **friends**, and **direct messages** events that currently have no notifications, then send live test pushes to your device.

## Current state
- `user_notifications` table + `useNotifications` hook + `push-send` edge function (web-push) + `push_subscriptions` table all exist and work.
- Tournament/venue/event reminders already create notifications via edge functions.
- **No triggers exist** for community posts, group events, friend requests, or DMs — so they're silent today.

## What gets added (DB triggers + push fan-out)

| Trigger source | When | Recipients | Notification |
|---|---|---|---|
| `group_posts` INSERT | New post in a group | All active group members except author | "New post in {group}" → opens group feed |
| `group_events` INSERT | New event scheduled | All active group members except creator | "New event: {title} on {date}" → opens schedule |
| `friendships` INSERT (status=`pending`) | Friend request received | The `friend_id` recipient | "{actor} sent you a friend request" → `/player/friends` |
| `friendships` UPDATE → `accepted` | Friend request accepted | The original requester | "{actor} accepted your friend request" → friend's profile |
| `direct_messages` INSERT | New DM | All conversation participants except sender | "{sender}: {preview}" → `/player/messages/:conversationId` |
| `group_messages` INSERT | New group chat message | All active group members except sender | "{sender} in {group}: {preview}" → group chat |

Each trigger:
1. Inserts a row into `user_notifications` (respecting `notification_preferences.in_app_enabled` for the category).
2. Calls `push-send` via `pg_net.http_post` with the dispatch secret (respecting `push_enabled`), so registered devices get a real web-push.
3. Uses `category` values: `community`, `social`, `messages` (so users can toggle each independently in notification settings).

A small SQL helper `public.enqueue_notification(user_id, type, category, title, message, link, actor_id, metadata)` will do the insert + push dispatch in one call to keep triggers tidy.

## Test pushes
After the migration is approved and applied, I'll call `push-send` directly through the edge-function test tool, targeting your user id, with three sample payloads:
1. **Community** — "New post in Demo Group"
2. **Friends** — "Alex sent you a friend request"
3. **Messages** — "Alex: Hey, ready for tonight?"

You'll need to have allowed push notifications on the device/browser (i.e. `push_subscriptions` has a row for you). If you haven't subscribed yet, I'll point you at the notification settings page first — otherwise tests will return `sent: 0`.

## Out of scope
- Email delivery (notification_preferences.email_enabled is respected for the flag, but no email send is wired here).
- Per-group muting beyond the existing `group_notification_prefs` table — I'll honor it for `group_posts`/`group_events`/`group_messages` if a row exists, default = on.
- Bulk backfill for past posts/messages — only new activity going forward triggers notifications.