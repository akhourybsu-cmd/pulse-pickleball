# Friends experience verification

## What changed

- One account-scoped friends cache supplies Social, dashboard, discovery, profile actions, and the message picker. Optimistic updates and per-person write guards are shared across those surfaces. Rollbacks restore only the failed person's connection.
- Requests have explicit received/sent sections, visible Accept/Decline controls, incoming-only badges, and correct notification destinations. Stale cancellations cannot delete an accepted friendship. Removal keeps its confirmation open on failure.
- Name and handle search, stable alphabetical ordering, an online filter, paged relationship loading, and bounded profile batches replace independent, sometimes stale lists.
- Player discovery now cancels obsolete searches, reports errors with retries, preserves current connection actions, and distinguishes a missing handle from a loading state. Hidden discovery/message sheets do not initiate friends fetches.
- Dashboard avatars open the selected player. Profiles can accept received requests or cancel sent requests. Chat entry no longer waits for an extra inbox refresh, and repeated taps are guarded.
- Presence clears on disconnect and stops advertising a hidden tab as active. Presence is advisory, not a guarantee that a person is available to reply.
- Desktop drawers are bounded to 480px. Mobile discovery cards preserve space for long names; requests use full-size labeled actions and safe-area-aware scrolling.

## Database and full copy/paste SQL

These migrations were deployed automatically. There is no manual SQL step required for production. The complete SQL is retained in these files; apply them in this order on another environment:

1. [Connection consent, atomic blocking, notifications, and realtime publication](../supabase/migrations/20260913100000_consistent_friend_connections.sql)
2. [Suggestions, mutual-friend search, and nearby block exclusions](../supabase/migrations/20260913110000_repair_friend_discovery.sql)

The live review exposed a pre-existing `suggest_friends()` error: its output column `weight` conflicted with an unqualified aggregate reference. A PostgreSQL regression test reproduces the original error before applying the repair. Search also now handles all four stored directions of a mutual-friend relationship. Nearby discovery continues to require reciprocal location opt-in and excludes blocks in either direction.

Realtime deletion handling uses cached relationship IDs because deleted rows cannot be matched by recipient-column filters. See [Supabase's Postgres Changes guidance](https://supabase.com/docs/guides/realtime/postgres-changes). A 60-second foreground refresh and focus/reconnect refresh remain fallbacks; no client subscription is treated as guaranteed delivery.

## Verification

- Final `npm test`: 608 passed, 32 skipped, 10 todo. `npm run build` succeeds. Focused ESLint and `git diff --check` pass.
- 21 focused state/search/pagination tests, including 1,201 connections, 1,002 blocks, missing profiles, API errors, and independent optimistic rollbacks.
- 26 PostgreSQL tests using a local, in-memory PGlite database. These execute the actual migrations, policies, and triggers with separate simulated authenticated roles. No live players, notifications, credentials, or messages are used. This is not a multi-session concurrency/load test.
- Live desktop checks: correct three existing friends and handles, handle filtering and clearing, friend-profile navigation, current Message action, suggestions and recent-player discovery, player code, and bounded drawer geometry.
- Responsive rendering: actual Friends/ConnectSheet components with fictional, local-only data at 390px and 320px, including long names, incoming/sent requests, and discovery. Measured document/dialog scroll widths equal the viewport widths. The in-app viewport override did not apply, so an isolated iframe fixture was used. Temporary preview files and servers were removed afterward.
- No real requests were sent, accepted, declined, canceled, or removed during browser QA. No messages were sent and no real sharing/blocking actions were performed.

Full application TypeScript checking still reports existing errors outside the changed friends surfaces (including venue/tournament types and round-robin types). These are not hidden by the production build and are not repaired as part of this pass. Physical-device keyboard behavior, multi-device presence, and concurrent production traffic remain follow-up device/integration checks.
