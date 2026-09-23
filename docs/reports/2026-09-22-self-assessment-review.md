# PULSE self-assessment: review and v2 implementation

Date: 22 September 2026. Base: `e4b324c8` (local `origin/main`). Implementation branch: `codex/assessment-evidence`. Changes are local and have not been deployed.

## Verdict

The original assessment is not a defensible skill predictor. Its most serious mathematical defect allows a single reliable answer to a basic legal-serve question to produce **4.7 in the pure scoring engine**, because basic evidence is reused to pass every higher anchor. The server still requires 20 scored answers, but inflated running estimates also drive adaptive selection. Its questions, confidence score and completion rules need improvement.

Version 2 fixes that inference defect and provides a clearer, more measurable assessment. It is still a **provisional self-report instrument**, not a validated player rating. No real player dataset, coach evaluations or match outcomes were available for validation in this review. Synthetic tests confirm engineering behavior, not predictive accuracy.

## Findings

| Priority | Finding and evidence | Change / remaining limitation |
|---|---|---|
| P1 | In `scoring.ts`, `cumulativeMasteryAtAnchor()` reuses every answer below an anchor. `interpolateLevel()` then passes unobserved higher anchors, including a synthetic anchor above 4.5. Reproduction: v1 `{ sv_legal: 'reliably' }` returns 4.7. This also distorts adaptive item selection. | V2 fits the difficulty of the questions actually answered and bounds extrapolation. The same basic-only answer cannot establish an advanced profile. Regression included. V1 remains frozen for old drafts/history; old results are not retroactively corrected. |
| P1 | Server completion in `_shared/skill/complete.ts` previously required only 20 scored answers. It did not require an adaptive finish, foundation completion or evidence across essential skills. | V2 requires the foundations, a terminal adaptive state, at least 20 scored answers, multiple observations for all six essentials and at least eight skills, and evidence in at least three dimensions. Normal early completion additionally seeks two scored answers in each of all four dimensions. At the hard cap, limited measures are disclosed. |
| P1 | `useSkillAssessment.answer()` advanced optimistically even when persistence failed. `start()` could resume a draft without reloading its answers. A failed retake completion could show an older result. Read errors were ignored. | Save before advancing; retain selection after failure; serialize writes; reload the draft when starting/resuming; keep failed unfinished retakes open; expose a retry screen for load failures. |
| P2 | The old “reliably” option bundled ordinary success, 80% frequency and pressure. “Drill only” mixed context with ability. Items such as “usually …” were answered with another frequency label. | Every new item separates situation, success criterion and response frequency. The six slider points mean approximately 0/2/4/6/8/10 successful game opportunities. Practice-only/unknown experience is separate. Pressure is asked explicitly. |
| P2 | Agreeing with “I know” or “I understand” does not establish execution. Statements combined several skills and invited optimistic self-identification. | New prompts ask about observed decisions and outcomes in recent doubles games. Some outcomes intentionally require a short sequence (three replies); that sequence is defined as one successful opportunity. Self-report and recall bias remain. |
| P2 | The old confidence model gives 20 consistency points with no evidence. With no corroboration context supplied by client or server, even a complete consistent self-assessment tops out around 40 and is always labeled low confidence. | V2 uses breadth across skills, essential coverage, measure coverage, unknown answers and conflicting claims. No evidence earns zero support. Self-only confidence is capped at 60. No activity, match or coach evidence is invented. |
| P2 | “Likely range” implied more statistical grounding than the heuristic interval had. Highly precise subskill estimates could come from very little evidence. | V2 shows a provisional guide range, explains that it is not a validated confidence interval, hides insufficient subskill scores, and exposes evidence counts. Numeric levels and interval width still require field calibration. |
| P2 | The previous answer list lacked an explicit confirmation and offered no answer review. Its radiogroup did not implement normal arrow-key radio navigation. | Native keyboard-accessible range input, large tap targets, explicit save, no silently accepted default, and an editable answer review. Legacy drafts retain their original response semantics. |
| P2 | Text-only terminology can be interpreted differently by beginners. A visualization can itself mislead if it mixes ball height, movement and placement. | Court diagrams distinguish player movement from ball paths, use correct court proportions and appropriate serving/receiving positions, and explain that top-down paths show placement, not height or spin. Animation is opt-in with pause and reduced-motion support. These are schematics, not technique videos. |
| P2 | New evidence diagnostics could leak through organizer cards if added at the snapshot top level: the existing SQL only removes `meta` and `contradictions`. | V2 evidence is stored under `meta`, already removed by the organizer RPC and client sanitizer. Regression confirms it stays private. |
| P3 | The profile CTA promised two minutes despite 44–60 old questions. A direct `?mode=retake` visit could open the old fingerprint. | Removed the unsupported timing promise; applied explicit retake intent once after loading. |
| P3 | Client and Edge Function scoring are maintained as separate copies. Drift can produce different previews and stored results. | Added byte-for-byte source parity checks and v2 server/client snapshot tests. Shared files still need to be copied together when edited. |

## The new assessment

The authored bank contains 64 situations: 16 skills, each with execution, repeatability, application and pressure prompts. A player normally sees 32–44, rather than the old 44–60. The first 16 establish breadth; later questions probe essential gaps, missing measures, inconsistent claims and stronger skills. Four measures do **not** mean four independent evidence sources: all are still the player's own answers.

If every foundation answer is unknown, the flow stops after 16 and offers review/practice guidance without publishing a level. It does not ask harder questions just to reach a quota.

Example:

> Situation: After your serve is returned, you try a soft third shot from the baseline.
>
> Success: The ball clears the net and lands in the kitchen.
>
> Response: Out of 10 opportunities like this, how many succeed?

Later drop questions separately ask whether the ball is attackable, whether it reaches a chosen opening, and whether it holds up on a close point. The player sees no hidden rating anchors.

The main skill areas follow the broad progression in the [USA Pickleball Player Skill Level Matrix](https://usapickleball.org/docs/levels/Player-Skill-Level-Matrix.pdf): basic control, consistent placement, purposeful shot selection and stronger competitive execution. Question wording, weights, anchors, fitting parameters and PULSE descriptive bands are our own design judgments, not USAP-certified calibration. No DUPR conversion is claimed.

## Scoring assumptions

V2 uses a transparent criterion curve: expected success is 80% at an item's authored anchor, with a logistic width of 0.45 rating units. A grid search fits each skill from the reported frequencies. This is not a fitted item-response model: difficulty and discrimination parameters have not been learned from actual players.

- One answer cannot establish a skill above its observed anchor. Multiple answers allow at most half a level of extrapolation beyond the highest observed anchor. All v2 estimates cap at 4.5.
- Overall level blends the mean of observed subskills (65%), the weakest observed essential skill (20%) and strategy (15%). The overall estimate cannot exceed that essential floor by more than 0.5. These are explicit, conservative hypotheses to validate, not established sport science.
- Each skill gets equal influence in the mean; receiving extra adaptive questions does not give its domain extra votes.
- Unknown is excluded from execution scoring and reduces evidence support. Incomplete evidence cannot become a publishable low rating.
- Contradictory patterns reduce confidence and prompt follow-ups. They are not evidence of dishonesty.
- The guide range widens as evidence support falls. Its width is heuristic and should not be interpreted as a statistical coverage guarantee.
- V2 does not assign a play-style persona from limited self-report evidence. Relative strengths and development priorities remain available when supported.

The original response keys are retained to remain compatible with the existing database constraint. In v2, `drill_only` is an opaque storage key for 2/10, not a practice-context answer. Attempt version selects all interpretation. V1 questions and stored snapshots keep their original semantics.

## Synthetic checks

Reproduce with `node --experimental-strip-types scripts/skill-assessment-audit.ts` on Node 24+. These synthetic players are generated from the same curve used by the scorer, so this is an internal consistency check, **not independent validation**.

| Simulated profile | Questions | Displayed estimate | Guide range |
|---|---:|---:|---|
| Uniform 2.0 | 32 | 2.1 | 1.8–2.5 |
| Uniform 2.5 | 32 | 2.6 | 2.2–3.0 |
| Uniform 3.0 | 32 | 2.9 | 2.5–3.3 |
| Uniform 3.5 | 32 | 3.3 | 2.9–3.6 |
| Uniform 4.0 | 44 | 4.1 | 3.8–4.5 |
| Uniform 4.5 | 44 | 4.2 | 3.9–4.5 |
| Power skills 4.5; essentials 2.5 | 44 | 3.1 | 2.8–3.5 |

The upper-end compression is visible even in these simulations. Do not claim accuracy to 0.1 just because the interface displays tenths. A coach-led calibration pass should evaluate the essential-floor rule and upper-end cap before using the estimate for firm event eligibility.

## Validation needed for a predictive claim

1. Have qualified coaches independently review every situation, success criterion and hidden difficulty anchor. Include the diagrams in this review.
2. Recruit a pilot spanning beginners through advanced players, different ages, mobility profiles, backgrounds and regular opponents. Record singles/doubles context separately; this version assesses doubles.
3. Collect assessments before disclosing existing ratings. Obtain blinded coach observations using the same success criteria and sufficiently established match-based ratings with dates and uncertainty.
4. Fit and evaluate on different players. Report absolute error, signed bias by skill band, overplacement rates, interval coverage and test/retest stability. Do not tune and validate on the same cohort.
5. Investigate uncertainty rates and question interpretation through short player interviews. Log item version, answer, order and completion time with appropriate privacy controls; timing alone must not be treated as skill or dishonesty evidence.
6. Decide an acceptable placement error with product and coaching stakeholders before rollout. Use conservative entry guidance and an observed assessment when evidence is limited.

## Verification and release

- Assessment checks: 92 passed; 26 existing backend integration scenarios skipped because their test environment is not configured. Includes frozen v1 behavior, v2 skill estimates, bounded runs, completion guards, unknown answers, power imbalance, pressure, conflicts, source parity, privacy and reduced-motion rendering.
- Browser checks with the real page and hook against an isolated local persistence adapter: initial selection gate, keyboard slider, save failure/retry, reload/resume, answer edit, completion, evidence breakdown, retake, animation play/pause and 390px overflow check. No real player account or production data was used.
- Targeted lint: passed. Whole-app TypeScript still reports errors in untouched tournament, group, round-robin, dashboard and development-preview files; assessment files are clean in the checked output.
- Broad suite during review: 1,292 passed; four pre-existing round-robin persistence-contract assertions failed and one venue-admin case timed out. The venue-admin file passed all 15 cases when run separately. The failing round-robin test and its SQL sources were not changed here. Backend integration scenarios remain unverified.
- Production bundle: passed outside the sandbox (`vite build`, 4,736 modules). Existing chunk-size, mixed-import and Browserslist warnings remain. No deployment was performed.

Deploy the updated `skill-complete` Edge Function **before** the frontend that creates v2 attempts. It accepts versions 1 and 2; the old server rejects v2. Existing columns and response-key constraints support v2, so no database migration is required for this implementation. Retain the current assessment feature flag. Existing completed snapshots remain immutable and older open drafts use their original flow.

Local preview: run `node node_modules/vite/bin/vite.js --config tests/skill/browser/vite.config.ts --host 127.0.0.1 --port 5198`, then open `/tests/skill/browser/index.html`. The preview provides scenario selection and save-failure testing with isolated local storage. It is not part of the production route or deployment.
