# Guest lifecycle review — October 3, 2026

## Fixed

- Email invitations called a service-only endpoint from the browser, used an unregistered template, and treated resolved request errors as success. A dedicated endpoint now verifies the caller's live session/MFA and guest-management access, derives the recipient and link from the saved invitation, and queues the registered template. The UI distinguishes queue success from delivery failure and supports retry, copy and revoke.
- An invitation with `requires_approval=false` allowed automatic linking even when the account email differed. Only a confirmed matching email now links automatically. Other requests need approval; pending requests cannot be taken over. Claim/approval locks, expiry, revocation and retries are enforced in the database.
- Direct guest deletion could erase roster rows and schedule seats. Guest removal now archives, retains event/history references, revokes outstanding invitations and supports restore. Clients cannot directly change account links or fabricate invitations.
- Claimed guests were omitted from event lists and access checks; later scores also missed their statistics. Existing guest seat IDs stay intact, linked accounts can open their events, history/statistics attach to the account, and future scores refresh those totals. Guest games remain unranked. Shared registration reuses the original guest row.
- Merging dropped invitations and could collapse separate participants. Safe merges preserve schedule, history, invitations and venue references. Conflicting records and guests in draft/live events are rejected with an explanation.
- Guest pickers truncated at 100 records, ignored read failures, reused account-independent caches and allowed duplicate rapid submissions. They now load stable pages, scope caches to the account, filter archived/claimed guests before retrieval, offer search/retry and guard creation. The guest manager also supports name/email editing and correctly reports failed database actions.

## Verification

- Isolated PGlite tests execute production claim, merge, RLS, scoring, statistics and registration functions. Scenarios cover creation, denied access, MFA, invitation retries, expiry, wrong/unverified email, organizer/group approval, revocation, archival/restoration, past/future scores, event visibility, duplicate identities and merge reference preservation.
- Mail-boundary tests cover trusted recipient selection, canonical URLs, failed/suppressed delivery, overlapping requests and queued-email retries. They stub mail delivery and send no real messages.
- Client contracts cover pagination past 500 guests, failure reporting and preserved login/confirmation-tab redirects.
- Browser checks use the real React screens with the isolated fixture under `tests/guests/browser`: invitation failure/retry/revoke, archive/restore, checkbox selection and a rejected merge, sign-in return and account claim, saved-guest search, rapid double-click creation and committing guests to the round-robin picker. No browser errors were recorded for the completed picker flow.
- Focused regression run: **341 tests passed across 38 files**, covering guests and the round-robin engine, database lifecycle, access, registration, UI and performance tests. Application TypeScript and focused lint checks passed.

## Limits and operational behavior

- Local simulations do not prove receipt in a real inbox. The interface says “queued,” and existing transactional-email worker/provider logs track subsequent delivery. No invitations were sent to real guests during this review.
- Existing conflicting identities require organizer review; the migration only backfills unambiguous account/history links. It does not rewrite live pairings or retroactively make guest games ranked.
- New invitation requests are limited to 30 per organizer per hour; retry attempts use the same request and email idempotency keys. Failed/uncertain sends have a two-minute retry cooldown.

Run the browser fixture with `node node_modules/vite/bin/vite.js --config tests/guests/browser/vite.config.ts --host 127.0.0.1 --port 5184 --strictPort`. Open `/tests/guests/browser/index.html`, adding `?claim` or `?picker` for the other flows. Fixtures are not routes in the production app.
