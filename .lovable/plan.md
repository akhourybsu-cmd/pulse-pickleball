
# Friends Section Redesign

## Problem

Today the "Add Friend" flow is a single open search field that queries `profiles` by name. That means anyone can browse the entire user base by typing names — bad for privacy, and also not the easiest way to actually connect with people you already know. The Friends tab itself is functional but flat: search bar + Add button + list, with no real prioritization, no suggestions, and no entry points beyond name search.

## Goals

1. Remove open-ended discovery of strangers by name.
2. Give players multiple low-friction ways to connect with people they actually know or have played with.
3. Make name search still possible, but **scoped** to a trusted graph (mutual friends, shared groups, shared events).
4. Polish the Friends tab UI so it feels on-brand with the rest of the player app (Outfit headings, white-card system, 8pt spacing, on-brand primary).

---

## New connection model

Replace the single "search everyone" entry point with a **Connect** hub that surfaces five paths, in order of friction:

1. **Your Pulse handle / QR code** — every player gets a personal invite. Tap to reveal a large QR + shareable handle (e.g. `pulse.app/u/alex-7Q4`). Share sheet uses native share on mobile.
2. **Enter a handle or invite code** — paste/type a short code instead of searching names. Direct lookup, no browsing.
3. **People you've played with** — auto-suggested from shared `matches`, `event_registrations`, `tournament_registrations`, and `group_members`. This is the highest-signal source and replaces 90% of what name search is doing today.
4. **Friends of friends** — second-degree suggestions from `friendships`, with mutual-count badge ("3 mutual").
5. **Search by name — scoped** — only returns users who share at least one group, event, tournament, or mutual friend. Strangers never appear.

Pending requests (incoming + outgoing) get their own dedicated surface so they aren't buried.

## Friends tab — visual redesign

Bring the tab in line with the player visual identity:

- Header row: count pill ("12 Friends") + segmented control [ All · Online · Requests (n) ] instead of one flat list with a hidden requests block.
- Friend cards: white-card surface, Outfit name + Inter rating, online dot inline with name, primary action = Message, overflow menu = View profile / Remove / Block.
- Sticky "+ Connect" CTA bottom-right (FAB style) opens the new Connect sheet.
- Empty state: illustrated, with three quick actions (Show my QR · Enter code · See suggestions).

## Connect sheet (replaces AddFriendDialog)

Bottom sheet on mobile, dialog on desktop. Single screen with collapsible sections in the order above. Each section:

- **My code** — QR + handle + Copy + Share buttons.
- **Enter code** — single input, validates against handle, shows the matched player card with one-tap Add.
- **Suggestions** — horizontally scrollable cards for "Played with" and "Mutual friends", each card shows avatar, name, context line ("Played 3 matches" / "5 mutual"), Add button.
- **Search** — name input, scoped server-side; empty state explains the scope ("We only show players you share a group, event, or friend with").

## Backend changes

1. **Add `handle` column to `profiles`**: `text unique`, auto-generated on profile insert via trigger (`<slug>-<3char>`). Add `GRANT SELECT` so the public `profiles_public` view exposes only `id, display_name, avatar_url, handle, current_rating`.
2. **New RPC `search_connectable_users(q text)`** (security definer): returns at most 20 profiles whose `display_name`/`handle` match `q` AND the caller shares a group, event, tournament, friendship, or mutual friend with. Replaces the current open `profiles.ilike` query.
3. **New RPC `suggest_friends()`** (security definer): returns ranked list of (user_id, reason, weight) drawn from shared matches, events, groups, and mutual friends. Excludes existing friends, pending, blocked.
4. **New RPC `lookup_by_handle(h text)`**: exact-match handle resolver for the "Enter code" path.
5. Update `AddFriendDialog`'s `profiles.ilike` call to call `search_connectable_users` instead. Keep RLS as-is on `profiles`.

## File-level changes

- `src/components/community/FriendsTab.tsx` — rework header into segmented control, polish cards, add FAB, route requests to their own segment.
- `src/components/community/AddFriendDialog.tsx` → rename to `ConnectSheet.tsx`. New layout with the five sections above.
- `src/components/community/MyHandleCard.tsx` *(new)* — QR + handle + share, using `qrcode.react`.
- `src/components/community/SuggestedFriendsRow.tsx` *(new)* — horizontal scroller bound to `useFriendSuggestions`.
- `src/hooks/useFriendSuggestions.ts` *(new)* — wraps `suggest_friends` RPC, React Query cached.
- `src/hooks/useFriends.ts` — add `lookupByHandle`, swap search to `search_connectable_users`.
- `supabase/migrations/<ts>_friend_connections.sql` — `handle` column + backfill + trigger, three RPCs above, GRANTs.

## ASCII layout

```text
 Friends                         (12)
 [ All ][ Online ][ Requests • 2 ]
 ─────────────────────────────────
 ● Alex Kim       4.25       💬
   Played 3 matches together
 ─────────────────────────────────
 ○ Sam Patel      3.80       💬
   Member of "Sunset Doubles"
 ─────────────────────────────────
                              ╭───╮
                              │ + │  Connect
                              ╰───╯
```

## Out of scope

- Contact-book import (iOS/Android permissions) — flagged as a follow-up.
- Push notifications for new requests — assumed already covered by existing notification system.
- Changes to the Messages or Groups tabs.

## Open question

Do you want a single global handle like `@alex-7q4` (visible to everyone, used everywhere), or a rotating short invite code that expires after N days? Global handle is simpler and matches the QR pattern; rotating code is more private.
