# Player App QA Pass — Home, Matches, Community, Profile

## Goal
Audit all four player tabs end-to-end against the live preview using the injected session, then fix small bugs inline and surface larger ones for approval.

## Approach

### 1. Static audit (parallel subagents)
Spawn focused read-only investigations per tab to catch issues without flooding context:
- **Home** (`PlayerDashboard`, identity card, needs-attention, upcoming events, friend activity)
- **Matches** (`NewMatch`, `PendingMatches`, `EventMatchEntry`, match list, record-match wizard)
- **Community** (`Community`, `GroupDetail`, `PostDetail`, `DirectMessages`, friends, notifications)
- **Profile** (`PlayerProfile`, `ViewProfile`, `EditProfile`, settings sub-pages)

Each subagent checks for: null/undefined access (especially guest vs profile), broken navigation links, dead routes (post-venue/tournament archive), stale React Query keys, missing loading/empty states, RLS-blocked queries, "Unknown" / "Someone" fallbacks, and obvious a11y/SEO gaps.

### 2. Live runtime check (Playwright)
Drive localhost with the injected Supabase session at 411x730 viewport:
1. Land on `/` → screenshot Home, capture console + network errors
2. Tap each bottom-nav tab, screenshot, collect errors
3. Walk one key flow per tab:
   - Home → tap a "needs attention" item
   - Matches → open Record Match wizard through step 2
   - Community → open a group → open a post → open composer
   - Profile → open Edit profile and a settings link
4. Click an avatar anywhere → confirm `/profile/:id` works
5. Collect all 4xx/5xx requests and console errors per page

### 3. Triage + fix
For each finding, classify:
- **Small (auto-fix now)**: null guards, dead links, wrong icons, missing loading state, copy fixes, stale imports of archived venue/tournament components — single file, <~30 lines.
- **Large (flag for approval)**: schema changes, multi-file refactors, RLS/policy changes, edge function changes, anything touching auth or payments.

### 4. Report
Reply with a per-tab summary: ✅ clean / 🔧 fixed inline (with file refs) / ⚠ flagged for approval (with proposed fix). One short paragraph per tab plus a deduped list of cross-cutting issues.

## Out of scope
- Venue and tournament surfaces (archived behind `AdminGuard`)
- Design/visual polish unless it's a clear bug
- Backend perf tuning unless a query is outright failing

## Deliverable
Fixed PRs for small bugs + a triaged report of flagged items awaiting your go-ahead.
