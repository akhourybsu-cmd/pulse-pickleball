# Friends chat: fix errors + redesign inbox

## What's broken

**1. RPC bug crashes the Friends page (and likely related flows).** Console shows:

```
Error fetching friend suggestions: column mp2.user_id does not exist
```

Both `public.suggest_friends()` and `public.recent_co_players()` join `match_participants` as `mp2` and reference `mp2.user_id`, but that table's column is `player_id`. Every call to these RPCs throws `42703`, so the Friends screen — the main entry point to start a DM — surfaces errors.

**2. Inbox loads with N+1 sequential queries.** `useDirectMessages.fetchConversations` loops every conversation and runs four awaited queries each (other participant, profile, last message, unread count). With even a handful of threads this is slow and any single failure aborts the whole list.

**3. No real way to sort/filter chats.** The inbox is just a search-by-name input over a single chronological list. There are no separators for unread vs. read, no per-conversation actions (mute/leave/mark-read), no empty-state CTA to start a chat from friends, and no visual cue for muted threads.

**4. Open-DM error messages are guess-parsed.** `Friends.openDM` regexes the RPC `message` string. RPC errors come back as PostgREST `PostgrestError` objects; matching is fragile and silently falls through to a generic toast.

## Plan

### A. Backend fixes (one migration)

Rewrite `public.suggest_friends()` and `public.recent_co_players()` to use `mp2.player_id` (and `mp1.player_id`) instead of `user_id` for the `match_participants` join. Keep all other CTEs (friends-of-friends, groups, events, tournaments) unchanged. Re-grant `EXECUTE` to `authenticated`. No schema changes, no new tables.

### B. DM data layer (`src/hooks/useDirectMessages.ts`)

Refactor `fetchConversations` to batch:

1. One query for my participations (id, last_read_at).
2. One `in()` query for conversation rows.
3. One `in()` query for the *other* participants per conversation.
4. One `in()` query against `profiles_public` for all other-user ids.
5. One query over `direct_messages` filtered by `conversation_id in (...)`, ordered desc, then reduced client-side to "last message per conversation" and "unread count per conversation" using `last_read_at` map.

Also: surface a `error` state from the hook so the inbox can show a retry banner instead of an empty list when something fails.

### C. Inbox redesign (`src/pages/player/DirectMessages.tsx`)

Keep the existing route and header; redesign the body:

- **Filter chips** under the search bar: `All`, `Unread`, `Muted`. Counts shown on `Unread`.
- **Sort menu** (icon button, right side of search): `Most recent` (default), `Unread first`, `Name (A–Z)`.
- **Sections** when sort = Most recent: pinned (future), then conversations grouped by `Today / This week / Earlier`. For other sorts, a flat list.
- **Conversation card** updates:
  - Larger avatar with online dot (already present).
  - Muted indicator (small bell-off icon) next to name when `is_muted`.
  - "You: " prefix on the last-message preview when the last sender is me.
  - Unread row gets a left accent bar (`bg-primary w-1`) and bold name.
  - Long-press / right-side `MoreVertical` per row → `Mark as read`, `Mute/Unmute`, `Leave conversation`. Wire to existing `conversation_participants` updates.
- **Empty state** gains a primary CTA `Message a friend` that opens a friend-picker sheet (reuse `useFriends` list), which calls the existing `startConversation` and routes into `/player/messages/:id`.
- **Loading**: keep the skeleton row count consistent with viewport.

### D. Open-DM error surfacing (`src/pages/player/Friends.tsx`)

Replace regex-on-message with a switch on the structured Postgres error code/`details`. The RPC raises with `ERRCODE 42501` plus a stable English message; map by substring of `e?.message ?? e?.error_description ?? ''` and also accept `e?.code === '42501'` as a generic "not allowed" fallback that still differentiates `friends`, `not accepting`, `can't message`. Same helper exported from a small `src/lib/dmErrors.ts` so `GroupMembers` and `FriendsTab` use it too.

### Out of scope

- Group DMs / multi-party conversations.
- New tables, RLS changes, or notification triggers.
- Friends page redesign (only the broken suggestion query is touched).
- Anything in `useTypingIndicator` or message-thread page beyond what already works.

## Files

- `supabase/migrations/<new>.sql` — rewrite the two RPCs.
- `src/hooks/useDirectMessages.ts` — batched fetch + error state + per-conversation `markRead`, `setMuted`, `leave` helpers used by the inbox.
- `src/pages/player/DirectMessages.tsx` — redesigned inbox with filter chips, sort menu, grouped sections, row actions, friend-picker empty CTA.
- `src/components/messaging/MessageFriendPickerSheet.tsx` (new) — bottom sheet listing friends with search; calls `startConversation`.
- `src/lib/dmErrors.ts` (new) — `interpretDmError(err) -> { toast: string }`.
- `src/pages/player/Friends.tsx`, `src/components/community/FriendsTab.tsx`, `src/components/community/GroupMembers.tsx` — use the shared error helper.

No changes to `DirectMessageChat.tsx` behavior, the realtime channel, RLS, or `get_or_create_dm_conversation`.
