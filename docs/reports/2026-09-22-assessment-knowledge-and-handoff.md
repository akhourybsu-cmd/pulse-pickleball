# PULSE assessment: discovery, account transfer and learning context

Reviewed 22 September 2026. This work is local and has not been published.

## Delivered experience

- With `VITE_SKILL_ASSESSMENT=on`, the anonymous homepage leads with **Take my free assessment**. Navigation and the next section repeat the invitation. The branded sample result is explicitly illustrative.
- The full report remains available before signup. Account creation is offered to retain the report and build a history, not to reveal a hidden result.
- `/pickleball-guide` is public. It covers rules and fundamentals, all 16 assessed skills, definitions, useful observations, common misunderstandings, practice suggestions, terminology, PULSE bands and scoring limitations.
- Question help explains the current skill. Report context uses the unrounded PULSE band and links to the guide. Individual skill details link directly to the relevant explanation.
- The existing PULSE logo, pulse trace, four accent colors and reduced-motion support continue across these surfaces. The guide uses keyboard-accessible disclosures, search and source links.

## Account-transfer audit

| Finding | Resolution and evidence |
| --- | --- |
| Password sign-in emits `SIGNED_IN` before the MFA profile check finishes. Both the Auth listener and global App listener could redirect prematurely. | Auth owns its in-progress password/MFA transition. The global listener no longer navigates away from `/auth`. A failed MFA-profile lookup signs out instead of continuing. Mock browser checks exercised challenge display, cancellation and retry. |
| A delayed save could finish after the user or assessment changed. | The transport pins the request to the initiating account, checks the fresh session owner, supplies that session's bearer token, and verifies the current page/account/draft before accepting the response. A changed or unmounted page cannot clear answers. |
| A stalled request could leave “Saving” indefinitely. | A 25-second deadline aborts the request and offers retry. The same attempt UUID is reused because a timed-out request might already have committed. Late results do not confirm success. |
| Expired sessions and already-linked reports shared a generic error. | Dedicated sign-in and account-conflict recovery explain the problem. A retry sign-in ends the local session explicitly. The selected destination account is shown before saving. |
| A redirect stored in one tab could be cleared by an older tab. | Arrival acknowledges only its matching return URL. Session and local storage retain the assessment destination through competing auth resolvers and confirmation tabs. Blocked storage is caught and reported. |
| An old guest tab could request a save after another tab replaced the assessment. | Save-intent persistence checks the current stored attempt first. Automatic save is attempted once per report; changing accounts does not silently start a second automatic transfer. |

The pre-existing guest import design was also reviewed and retained: the edge function validates the caller with `getUser`, rejects anonymous accounts, recomputes from bounded raw answers and uses the caller's ID. The SQL transaction stores responses and the complete snapshot atomically, rejects another owner's attempt, preserves an existing draft and visibility, starts new profiles private and leaves the Performance Rating untouched. Browser-provided scores or owner IDs are not authoritative.

### Remaining authentication release gates

**Local checks cannot certify live providers or production deployment.** The browser preview uses an isolated adapter and fake identities, while the SQL tests use PGlite. No real account, email, OAuth provider or deployed edge function was exercised in this pass.

There is also an existing, broader MFA limitation: `verify-mfa-code` consumes a custom email code and returns `{ success: true }`; it does not establish a Supabase second-factor session or a server-verifiable, session-bound assurance record. `skill-claim` currently requires a valid authenticated user but does not enforce second-factor assurance. The UI race fix does not close direct-API/reload bypasses of a client-only challenge. Treat server-enforced MFA as a separate release blocker wherever PULSE promises MFA protection. Resolve it consistently across protected data and endpoints, including claim, rather than treating a client flag as authorization.

Before enabling the production funnel, use a staging project with this migration and edge function deployed:

1. Complete as a guest, request save, create a new account with email confirmation enabled, open the confirmation in the original tab and a second tab, and confirm exactly one completed assessment in the correct account.
2. Test confirmation opened in another browser/device. That browser must explain that it lacks the guest answers; returning to the original browser and signing in must retain the save path.
3. Exercise existing-account password sign-in, enabled OAuth providers, password reset return, expired sessions and duplicate-email signup behavior. Verify provider callback allowlists, site URL and email templates on the actual deployment origin.
4. Verify server-enforced MFA for password, OAuth, refresh and direct API access. Exercise success, cancellation, invalid codes and network failures.
5. Interrupt or delay a save, retry and refresh. Confirm one attempt, one final snapshot, no overwritten active draft and no change to match ratings.
6. Use two different accounts and concurrent tabs. Reject cross-account ownership; an account change must never silently accept or remove the other account's report.
7. Test storage blocked, storage cleared, seven-day expiry, missing return links and missing guest drafts. Show a recovery message rather than suggesting a successful transfer.
8. Reopen the saved history on a second device. Confirm all skill scores, evidence and answer counts match the original authoritative report, and verify private visibility.

Keep the assessment flag off until these checks pass. Deploy the database migration and edge function before exposing the homepage CTA; the learning guide can remain public independently.

## Knowledge review and score meaning

The source-backed content distinguishes **rules**, **technique**, **decisions**, and **evidence**. It addresses legal serving, the two-bounce rule, kitchen boundaries and momentum, scoring formats, readiness, coordinated movement and adapted rules. The 16 skill entries cover serve, return, forehand, backhand, drive, third-shot drop, dinking, dink strategy, speedups, counters, volleys, resets, transition, overheads/lobs, positioning and strategy.

Important teaching corrections include:

- A ball landing in the kitchen is not necessarily unattackable. Assess the opponent's contact and the next reply.
- A third-shot drive can create a useful fifth-shot drop; neither third-shot choice is automatically right for every return.
- Advancing after a soft shot depends on its quality and the opponent's reply. Transition play requires balanced decisions, not blind rushing.
- Successful execution is not synonymous with winning a point. Decisions and outcomes should be observed separately.
- Count comparable game opportunities rather than selected highlights. Drills help learning but do not directly supply the assessment's game evidence.

The guide explains the actual v2 model without implying independent validation:

- Skill fitting considers execution 30%, consistency 30%, application 25% and pressure 15%, question difficulty and available evidence.
- The overall blend is 65% average of answered skills, 20% weakest answered essential and 15% strategy, with the existing fallback when strategy is unanswered.
- The foundation ceiling is 0.5 above the weakest essential. The v2 estimate is bounded to 1.5–4.5. Band context uses the raw estimate; the headline is rounded.
- Two scored answers support a skill; unanswered or thinly covered skills stay visibly uncertain. The report may finish before every skill has multiple observations, so the evidence breakdown matters.
- Self-report confidence is capped at 60/100. It is coverage/agreement evidence, not a probability of correctness. Guide ranges are not validated confidence intervals.
- The four success summaries can cover different situations and numbers of questions. Equal percentages do not establish equal difficulty or comparable mastery.
- PULSE Self-Assessed Level, PULSE Performance Rating and external ratings are distinct. In particular, PULSE's current band names are not a USA Pickleball/DUPR conversion. The 4.5 ceiling does not establish expert or professional ability.

No scoring weights, historical bands or saved results were silently changed in this pass. Rules and coaching sources support the explanations; they do not validate PULSE's numeric calibration.

### Calibration work required for accuracy claims

Recruit players across the intended doubles range, including beginners, with independent coach observations of the same skills. Keep coaches blind to the self-report, use multiple observations/raters, and retain a held-out group when tuning the model. Compare overall and per-skill error, systematic over/underestimation, repeatability, missing-data patterns, question selection and the effect of the essential-skill ceiling. Check pressure situations separately because the adaptive sequence can collect fewer observations there. Measure whether reported changes track observed changes rather than a player's familiarity with the questionnaire. Establish acceptance criteria before fitting and version any resulting calibration changes. Singles and adapted-play validity require separate work.

## Primary teaching references

The guide includes sources beside relevant content and a consolidated source list. Principal references:

- [USA Pickleball rules summary](https://usapickleball.org/rules/summary/) and [current rulebook index](https://usapickleball.org/rules/).
- [How to play](https://usapickleball.org/pickleball-skills/level-one/how-to-play-pickleball/) and [skill-level matrix](https://usapickleball.org/docs/skill-rating/USAP-Player-Skill-Level-Matrix.pdf).
- [Third-shot choices](https://usapickleball.org/pickleball-skills/level-three/mastering-the-third-shot-in-pickleball/), [reset technique](https://usapickleball.org/pickleball-skills/level-three/what-is-a-pickleball-reset-shot-and-how-to-hit-it/), and [transition play](https://usapickleball.org/pickleball-skills/level-four/pickleball-transition-area-and-reset-tips/).
- [Return of serve](https://usapickleball.org/pickleball-skills/level-three/return-of-serve-tips/), [speedup placement](https://usapickleball.org/pickleball-skills/level-three/successful-speedups-using-a-target/), [kitchen footwork](https://usapickleball.org/strategies/basic-kitchen-line-footwork-to-move-more-efficiently/), and [wheelchair rules](https://usapickleball.org/rules/wheelchair/).

Source text is summarized in original PULSE language. Review dates and limits are visible to users; the guide does not claim USA Pickleball endorsement.

## Engagement and measurement

Lead with useful analysis, then invite the player to preserve a starting point. The CTA explains cross-device access and history. Sharing invites a partner to their own assessment and carries no scores or answers. Avoid unsupported accuracy claims, false urgency or hiding the completed report behind signup.

The existing `pulse:assessment` event integration emits only event name and model version. It is a consent-aware analytics integration point, not an installed analytics pipeline. Suggested measurements after integration: assessment starts/completions, save intent, auth starts, confirmed saves, save failures and invitation copies. Segment by entry placement using an approved analytics design; do not transmit answers, scores, emails or assessment IDs as marketing telemetry. Optimize completion and successful retention together, rather than account clicks alone.

## Verification

- Focused assessment/scoring/homepage suite: **146 passed, 26 opt-in tests skipped**. Includes authoritative scoring, raw-answer validation, production-SQL import checks, retries, account changes, expiry/storage coordination, source coverage and public content.
- Changed-file ESLint: no errors; existing Auth biometric-effect dependency warning remains.
- Production Vite build passes. Existing bundle/Browserslist/Tailwind warnings remain.
- Application TypeScript check still reports the same 14 unrelated errors in tournament, group, round-robin, dashboard and dev-preview code; none are in these assessment changes.
- Browser checks: desktop and 390px homepage/guide; proper logo and sample labeling; no horizontal overflow; skill search; guest-to-signup copy; simulated confirmation-required signup; mock MFA waits/cancel/retry; failed save retains report; retry succeeds; saved history reopens full analysis.

The browser adapter does not establish production identity, OAuth behavior, real email delivery or server-side MFA enforcement. Those remain explicit release gates above.
