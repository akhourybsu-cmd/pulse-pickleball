# Communities: Instant Posts, Chats & Snappy Menus

Goal: every action in the community surface (post, comment, react, vote, RSVP, chat send) appears **immediately** on the user's screen, with no manual refresh, and composers/menus feel effortless to type and navigate.

## Problems today

1. **Round-trip waits, not optimistic.** `createPost`, `sendMessage`, `toggleReaction`, `joinLfgPost`, comments, and pin all wait for the server insert, then `invalidateQueries(...)` — which triggers a full refetch of posts + profiles + reactions + comments + participants + poll votes + round-robin joins (`useGroupPosts.fetchGroupPosts` does ~7 queries). User sees a stall, then the whole list re-renders.
2. **Realtime is coarse.** `useGroupRealtime` invalidates the entire `['group-posts', groupId]` / `['group-messages', groupId]` keys on any change. So an incoming reaction or comment re-runs the 7-query fetch. It also fires for the user's *own* change (double work) and races with the in-flight mutation.
3. **Chat send clears input only after server returns.** Send button shows spinner; text disappears late; on slow networks the message visibly "hops" in once the refetch lands.
4. **No optimistic rows.** New posts and chat messages do not appear instantly — they appear after the refetch round-trips.
5. **Composers/menus feel heavy.**
   - `QuickPostComposer` likely re-renders the whole feed on each keystroke (state lives in parent), and there is no submit-on-Enter / draft persistence.
   - `PlayerCombobox` (used in tag/mention pickers) only searches after typing, but renders the whole player list with no virtualization and re-creates filter array each keystroke.
   - Popovers/Sheets in posts/comments lack `autoFocus` on the input and a clear Enter-to-submit / Esc-to-close contract.
6. **Comments sheet** (`PostCommentsSheet` via `useGroupPostComments`) likely refetches on every send and has no optimistic append.

## What we'll change

### 1. Optimistic mutations (the biggest win)

For every write in `useGroupPosts`, `useGroupChat`, `useGroupPostComments`:

- Convert `useMutation` to use `onMutate` → `setQueryData` to splice the new/changed row in immediately, `onError` → rollback via the snapshot, `onSettled` → no full invalidation (let realtime reconcile).
- Generate a client-side `tempId` (uuid) so the optimistic row has a key; replace it with the real row when realtime delivers the INSERT.
- Mutations to convert:
  - `createPost` (insert optimistic post at top)
  - `deletePost` (remove immediately)
  - `togglePin` (flip + re-sort immediately)
  - `toggleReaction` (already half-optimistic for polls — extend to reactions: bump count + flip `user_reacted` now)
  - `joinLfgPost` / `leaveLfgPost` (flip `user_joined` + count immediately)
  - `castPollVote` already optimistic — keep, but remove the `invalidateQueries` on error in favor of snapshot rollback
  - `sendMessage` (append optimistic message with `status: 'sending'`; clear textarea **before** awaiting; mark `'sent'` on success, `'failed'` with retry button on error)
  - `editMessage`, `deleteMessage`, `togglePinMessage` (mutate cache directly)
  - `useGroupPostComments.createComment` / `delete` (optimistic append/remove, bump `comment_count` on parent post cache)

### 2. Granular realtime reconciliation

Rewrite `useGroupRealtime` to **patch the cache** instead of invalidating:

- `group_messages` INSERT → `setQueryData(['group-messages', groupId], prev => [...prev, newRow])` after de-duping against any optimistic temp row (match by `user_id + content + ~timestamp`, swap temp for real). UPDATE/DELETE → patch in place.
- `group_posts` INSERT → fetch only the new post + its author profile (single small query), then prepend. UPDATE → patch fields. DELETE → splice.
- `group_post_reactions` → adjust counts on the affected post only.
- `group_post_comments` → bump `comment_count` on parent; if comments sheet is open for that post, append to its cache.
- `group_event_rsvps`, `group_members`, `group_events` → keep current invalidation (low frequency).
- Skip self-originated events (compare `new.user_id` to current auth user) to avoid double work alongside optimistic updates.

Also: drop the `staleTime: 30s` → `Infinity` for `group-posts` and `Infinity` for `group-messages`, because realtime is now the source of truth. Keep React Query as the read cache.

### 3. Chat composer responsiveness

In `GroupChat.tsx`:

- Clear `newMessage` **before** awaiting `sendMessage` (currently already in that order, but combine with optimistic insert so the message appears in the list the same frame).
- Remove the disabled state on the textarea while sending — let the user keep typing the next message.
- Send button: don't show spinner; show a subtle ghost state on the optimistic bubble instead (small clock icon → checkmark).
- Keep focus in the textarea (already does), but use `flushSync` around the clear so the DOM updates synchronously and Android keyboards don't lose IME state.
- Auto-scroll only fires when (a) user is already near bottom or (b) it's the user's own message — prevents yanking the view when reading history while new messages stream in.

### 4. Post composer responsiveness

In `QuickPostComposer` / `ComposerQuickActions`:

- Isolate composer state so typing doesn't re-render the parent feed (`memo` the feed list; lift composer into its own component with internal `useState`).
- Add `Enter` to submit single-line types (LFG title, poll question), `Cmd/Ctrl+Enter` for multi-line feed/announcement.
- Persist draft to `sessionStorage` keyed by `groupId + type` so accidental nav doesn't lose text.
- Close sheet **before** awaiting the insert (optimistic post is already in the feed).

### 5. Popups & pickers feel snappy

- `PlayerCombobox`: debounce search input with the existing `useDebounce` (150ms), and cap rendered results to 50; add `autoFocus` on the `CommandInput` when the popover opens.
- All `Sheet`/`Dialog` text inputs in community surfaces (`PostCommentsSheet`, `CreateGroupDialog`, `InviteModal`, `JoinGroupDialog`, `MemberActionSheet`): add `autoFocus` to the primary input, wire `Enter` to the primary action, and `Esc`/backdrop to close. Keep open state in a `useState` that doesn't sit above the feed list.
- Reaction picker: pre-render the emoji set instead of mounting on open.

### 6. Query shape cleanup (supporting work)

- Split `fetchGroupPosts` so realtime patches can fetch a single post + author by id (`fetchGroupPostById`) instead of the whole list.
- Memoize the per-post derived shape (reactions/comment_count/etc.) so patching one post doesn't re-render every `PostCard`. Wrap post card in `memo` with a custom `propsAreEqual`.

## Out of scope

- Schema changes, RLS changes, push notifications, server-side anything.
- Non-community surfaces (venue feed, tournament chat) — same patterns can be applied later if this lands well.

## Technical notes

- Files touched (estimated):
  - `src/hooks/useGroupPosts.ts` — optimistic mutations, add `fetchGroupPostById`, drop blanket invalidations.
  - `src/hooks/useGroupChat.ts` — optimistic send/edit/delete/pin, temp-id dedupe.
  - `src/hooks/useGroupPostComments.ts` — optimistic comments + parent count bump.
  - `src/hooks/useGroupRealtime.ts` — switch from invalidate to `setQueryData` patches; per-table handlers; self-event skip.
  - `src/components/community/GroupChat.tsx` — non-blocking input, near-bottom scroll guard, optimistic bubble state.
  - `src/components/community/QuickPostComposer.tsx` + `ComposerQuickActions.tsx` — isolated state, draft persistence, Enter-to-submit.
  - `src/components/community/PostCommentsSheet.tsx` — autoFocus + Enter, optimistic append.
  - `src/components/community/ChatMessage.tsx` — render `status: 'sending' | 'failed'` affordance with retry.
  - `src/components/PlayerCombobox.tsx` — debounce + cap + autoFocus.
- No new dependencies; uses existing React Query, Supabase realtime, framer-motion.

## Acceptance checks

- Send a chat → bubble appears in the same frame, no spinner blocking typing; second device sees it within ~200ms with no list-wide re-render.
- Create a post → post is at the top instantly; reactions/comments update without refetching the whole feed.
- React to a post or vote in a poll → count updates instantly; rolls back on RLS error.
- Open `PlayerCombobox` / comments sheet → input is focused, typing is smooth, Enter submits.
- Network throttled to Slow 3G: composer never feels blocked; failed sends show a retry, not a swallowed error.
