## Goal
Make PULSE feel instant on mobile before submitting to Google Play and the App Store. Focus on cold-start time, bundle size, perceived responsiveness, and database/network latency — the things reviewers and real users notice in the first 30 seconds.

## Phase 1 — Measure (before changing anything)
Establish a baseline so we know what actually moved the needle.

- Run a production build locally and capture bundle sizes (`vite build` output + visualizer).
- Run Lighthouse mobile on the published URL for: Dashboard, Community feed, GroupDetail, Matches, Profile. Record LCP, TBT, CLS, total JS.
- Pull the **10 slowest Postgres queries** from Lovable Cloud (we'll target the top offenders).
- Skim recent edge-function logs for slow/erroring functions.

## Phase 2 — Frontend bundle + cold start
This is the biggest win for "feels fast" on a phone.

1. **Code-split heavy routes.** Wrap rarely-used pages in `React.lazy` + `Suspense`: TournamentLiveView, ManageTournaments, Kiosk, AdminArchive, all admin pages, DemoTour, Changelog, all venue/* pages, all onboarding pages. Player Dashboard / Matches / Community / Profile stay eager.
2. **Tighten `manualChunks`** in `vite.config.ts`: split `recharts`, `framer-motion`, Supabase client, and date-fns into their own chunks so route bundles stay small.
3. **Drop or dynamic-import unused-on-mobile libs.** Audit `package.json` for heavy deps only used in one page (e.g. chart/PDF/QR libs) and lazy-load them.
4. **Image hygiene.** Run `public/` PNGs through squoosh, convert hero/avatar fallbacks to AVIF/WebP via `vite-imagetools`, add `loading="lazy"` and `decoding="async"` to non-LCP `<img>`, add `fetchpriority="high"` to the dashboard's LCP image.
5. **Preload the LCP image** in `index.html` and preconnect to the Supabase domain.
6. **Font loading.** Confirm Outfit + Inter are loaded with `font-display: swap` and only the weights we actually use.

## Phase 3 — Data fetching + perceived speed
Make screens render content immediately instead of spinners.

1. **React Query defaults.** Set `staleTime: 30s` and `gcTime: 5min` globally; today many hooks refetch on every mount.
2. **Prefetch on navigation.** When the user taps a group/match/profile, prefetch its query before the route mounts.
3. **Skeletons over spinners.** Replace blocking spinners on Dashboard, Community, GroupDetail, Matches with skeleton cards so the layout never shifts.
4. **Kill N+1s** flagged in the recent audits — most importantly `useDirectMessages` (fetch-all-then-filter) and any list view that fetches per-row profile data instead of one batched `.in()`.
5. **Realtime hygiene.** Audit `useGroupRealtime` / presence / typing hooks — unsubscribe on unmount, only subscribe on the visible group.

## Phase 4 — Backend latency
1. Use `supabase--slow_queries` output to add targeted indexes (likely on `user_notifications(user_id, created_at)`, `group_posts(group_id, created_at)`, `match_participants(match_id)`, `round_robin_schedule(event_id)` — confirm from the report).
2. Review the heaviest edge functions (`push-send`, `generate-round-robin-schedule`, `process-email-queue`) for unnecessary awaits and parallelize independent calls.

## Phase 5 — Native shell (Capacitor) readiness
Since the goal is the stores, treat the native shell as part of perf:

1. **Stop loading the app from the Lovable preview URL on device.** In `capacitor.config.ts`, remove the `server.url` and ship the built `dist/` so the app launches instantly offline-capable instead of waiting on a network round-trip.
2. Add a native splash screen (`@capacitor/splash-screen`) sized to the manifest theme color so cold start looks instant.
3. Confirm push (`@capacitor/push-notifications`) and status-bar plugins are wired for both platforms.
4. Build a release AAB (Android) and IPA (iOS) and run them on a real device — measure cold start with the production bundle, not the preview.

## Phase 6 — Verify
- Re-run Lighthouse mobile and compare LCP / TBT / JS transferred against the Phase 1 baseline.
- Re-run slow-query report; confirm the top offenders dropped.
- Cold-start the native build on a mid-range Android device 3× and record time-to-interactive.

## Out of scope (call out, don't do silently)
- Store listing assets (screenshots, icons, descriptions, privacy policy URL) — separate task.
- App Store / Play Console account setup, signing keys, review submissions — you'll need to do these in your own Apple/Google accounts; I can't do them from here.
- Switching off Lovable Cloud or changing auth providers.

## Technical notes
- Bundle analysis: `npx vite-bundle-visualizer` after `vite build`.
- Lazy routes go through `React.lazy(() => import('...'))` with a single top-level `<Suspense fallback={<RouteSkeleton/>}>` in the router.
- Index creation runs via the migration tool (plain `CREATE INDEX`, no `CONCURRENTLY` inside a transaction).
- Capacitor change to drop `server.url` requires the user to `git pull`, `npm run build`, `npx cap sync`, then rebuild the native app.

## Suggested order if you want to ship fast
Phase 1 → Phase 2 (biggest perceived win) → Phase 5.1 (drop preview URL) → Phase 3 → Phase 4 → Phase 6.

Want me to start with Phase 1 (measure + report numbers) so we can prioritize from real data, or jump straight into Phase 2 lazy-loading?
