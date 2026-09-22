# Guest assessment → saved analysis

The assessment is a useful first experience of PULSE: take it without an account, read the full analysis, then create an account to keep it. Signup never unlocks hidden sections of the report.

## Implemented experience

1. `/skill-assessment` is public, outside `AuthGuard`. It uses the same version 2 visual questions, sliders, adaptive selection and scoring as the account assessment.
2. Answers remain in the browser. A refresh resumes progress. The browser copy expires after seven days; expired data is discarded when read. Browser storage can be cleared or evicted sooner. The interface explains the temporary retention and reports storage failures.
3. Completion immediately shows the provisional level, evidence coverage, strongest skills, supported development priorities, broad domains and individual skills. A next-game focus translates supported priorities into observable success criteria. Balanced profiles receive practice suggestions without inventing a weakness.
4. The report offers **Create free account & save my analysis**, plus a sign-in option for existing members. Benefits are concrete: keep the analysis, access it across devices, and revisit assessment history.
5. Signup/sign-in retains the assessment destination until the report page acknowledges arrival, avoiding competing auth-handler redirects. Email verification has persistent guidance to finish in the same browser. The original answers never appear in URLs or auth metadata.
6. Returning from authentication saves only when an explicit save intent and matching assessment ID are both present. Signing in alone does not claim a browser's cached report. An already signed-in player saves with one explicit click.
7. The server validates answers and recalculates the score. A protected transaction stores the attempt, raw answers, full snapshot, skill scores and evidence. It preserves an existing unfinished account assessment and never changes the match-based rating. New skill profiles start private; existing visibility preferences survive.
8. Save failures leave the analysis available with a retry. Repeated requests return the stored report without duplicating history. Local answers are cleared only after a confirmed authoritative save. Past reports are now reopenable from account assessment history.

An account is necessary for durable PULSE storage and history. The guest copy is a temporary convenience, not a cross-device backup. Authentication on another device cannot recover answers held only in the original browser. Users with insufficient game evidence receive review/practice guidance rather than an invented numeric level; the server refuses an unsupported estimate.

## Engagement built into the product

- Homepage navigation/footer link, hero link, dedicated three-step assessment section and FAQ.
- Public assessment page with clear expectations before starting.
- Save prompt on the completed report and signup copy that continues the same promise.
- A generic invitation link for playing partners. It shares the assessment entry point, never the player's results or answers.
- Next-game guidance and full history as reasons to return after signup.

The public route and marketing entry points follow the existing `VITE_SKILL_ASSESSMENT` build flag. It must be `on`, `true` or `1` in the target frontend build. Turning it off hides assessment routes and entry points; it does not delete saved reports.

## Suggested launch sequence

These are proposed experiments, not claims about measured conversion. No campaigns, emails, notifications, analytics integrations or production deployments were sent or activated during implementation.

| Stage | Placement and message | Learn from it |
| --- | --- | --- |
| Small pilot | Invite players through an organizer's existing channels: “Know your strengths. Find your next focus. Take the free PULSE assessment and read your full analysis before joining.” | Observe question comprehension, completion, uncertainty and whether practice advice feels actionable. Include beginners and experienced players. |
| Public launch | Homepage links already implemented; use the public assessment URL in approved social posts and court/club QR materials. | Compare starts, completions, voluntary save requests and successful saves. Avoid a rating number or a time-to-complete claim until validated. |
| Partner invitation | The report's “Copy assessment invitation” button. Suggested accompanying copy: “I found my next practice focus. Take yours and let's compare what to work on.” | Assess whether invited visitors complete an assessment, not merely whether links are copied. |
| Return to play | After saving, point players to their analysis and PULSE dashboard. Future opt-in reminders can ask whether they have new game evidence before retaking. | Measure return visits, reopened history and subsequent assessments. Do not equate a higher self-report with proven skill improvement. |

Start with the existing secondary hero link. Once the save handoff is reliable and completion is useful, test an assessment-first hero against the current account-first hero. Test one meaningful change at a time. A second useful test is “Save my analysis” versus “Keep my skill profile”; retain the same free, full-report-first promise in both.

Suggested measurements:

- Assessment completion / assessment starts.
- Explicit save requests / completed reports.
- Successful account saves / save requests, with existing members separated from new accounts when a consent-aware analytics integration is available.
- Authentication-return failures and save errors / save attempts.
- Report/history revisits and subsequent assessments after new play.
- Question comprehension and agreement with independent coach observations, alongside conversion.

`trackAssessmentFunnel` dispatches a local `pulse:assessment` event for `started`, `completed`, `save_requested`, `auth_started`, `saved`, `save_failed` and `invite_copied`. Payloads contain only the event name and assessment version. There is **no external collection yet**. Connect an approved, consent-aware analytics adapter before treating these as measured funnel data; deduplicate retries and distinguish signup from existing-account sign-in there. Do not send raw answers, skill levels, email, auth tokens or assessment IDs to marketing analytics. The `source` query strings identify entry links but are not currently recorded or attributed by this event helper.

## Deployment order

1. Review/apply `20260922180000_guest_skill_assessment_claim.sql` after the existing skill foundation and authorization fixes. The new import RPC is callable only by `service_role`.
2. Deploy `skill-claim`. Its gateway setting permits transport to the handler; the handler verifies `auth.getUser()` and rejects anonymous identities before every write. Keep the already-refined `skill-complete` and shared version 2 engine deployed as well.
3. Verify the target site's bare origin in the Supabase auth redirect allowlist and the confirmation email template. The code uses `emailRedirectTo` for signup and retains the existing bare-origin OAuth callback. Supabase documents both the [signup redirect option](https://supabase.com/docs/reference/javascript/auth-signup) and [redirect allowlist/template requirements](https://supabase.com/docs/guides/auth/redirect-urls).
4. Build/release the frontend with `VITE_SKILL_ASSESSMENT=on`. Ensure the host serves the SPA at `/skill-assessment` for direct visits. Review rendered social previews separately: client-side SEO metadata does not guarantee every social crawler will render route-specific tags.
5. On a staging deployment, exercise real email confirmation, OAuth, existing-member sign-in, expired sessions, failed saves, an existing account draft, and a new account still in onboarding. The local preview deliberately uses simulated identities, not real accounts or emails.
6. Confirm saved history and profile visibility; then launch the approved marketing placements. Keep the route available while active signup handoffs are completing if withdrawing promotional placements.

## Validation

- 118 assessment and homepage tests passed; 26 pre-existing opt-in tests skipped.
- Production build passed. Whole-app TypeScript still reports 14 pre-existing errors in untouched tournament, group, round-robin, dashboard and development-preview code; no assessment/auth changes were reported.
- Focused lint has no errors. `Auth.tsx` retains its pre-existing biometric-effect dependency warning.
- PostgreSQL-compatible PGlite tests execute the actual foundation, finalization and import SQL: atomic persistence/rollback, private defaults, existing visibility and draft preservation, owner rejection, idempotent retry and service-only permissions.
- Browser checks: no-account start, answer/refresh resume, full analysis before signup, tailored auth screen, simulated auth return, failed transfer/retry, saved history reopening, no implicit claim on unrelated sign-in, and no horizontal overflow at 390px for the report and homepage.
- Real Supabase JWT handling, email/OAuth provider configuration, concurrent network requests and production deployment remain staging checks. The local preview is not evidence that those external services are configured.

The skill model remains a provisional, unvalidated self-report estimate. This release improves access, interpretation and retention; it does not establish empirical predictive accuracy. The prior assessment review describes the calibration work required before making stronger rating claims.
