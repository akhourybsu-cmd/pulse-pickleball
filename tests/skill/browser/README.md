# Local assessment preview

From the repository root:

```powershell
node node_modules/vite/bin/vite.js --config tests/skill/browser/vite.config.ts --host 127.0.0.1 --port 5198
```

Open [the preview](http://127.0.0.1:5198/tests/skill/browser/index.html).

This renders the production assessment page, hook, question card and result components against a local-storage Supabase adapter. It makes no backend requests. Use the toolbar to inspect all 64 scenarios, simulate a failed save, seed a completed questionnaire, reset preview data or constrain the layout to phone width. Reload to verify draft resume.

The preview now starts at the public guest flow and remembers its route on refresh. Use **Seed guest questions** to reach completion, then **See my results** to inspect the full guest report. The save CTA opens the actual Auth presentation. **Simulate sign-in** triggers the local auth return. The actual form can also be tested using only dummy data such as `player@example.test`: signup returns a confirmation-required response without sending email, while password sign-in emits a mock session. **Require mock email MFA** makes that sign-in show the real challenge UI; use Send code and then enter `123456`; other codes fail in the local stub. Pending verification survives a page refresh. The preview now uses the real AuthStateProvider; only the backend adapter is replaced. This is a UI timing test, not an MFA security test. **Fail next save** exercises claim retry. **Account flow** opens saved history. **Homepage** shows the public entry points with the assessment flag enabled and links to the searchable guide. All identities and saved reports in this preview are local fixtures; never enter real credentials.

Guest checks exercised: answer/refresh resume; report before signup; assessment-specific Auth copy; automatic save only with matching explicit intent; failed transfer retains report and retry succeeds; history reopens full analysis; unrelated sign-in does not claim a guest report; report/homepage fit a 390px viewport. Database authorization and transactional behavior are covered separately by `guest-claim-database.test.ts` against the actual SQL. Real email verification and OAuth must be checked in staging.

Checks exercised: unselected answer cannot continue; keyboard slider; failed save retains selection; retry advances once; reload resumes; review/edit preserves the update; completion calls the authoritative pure core; result discloses evidence; retake clears answers; animation play/pause; no horizontal overflow at 390px. The backend adapter does not validate RLS, real JWT authorization, network latency or concurrent server transactions.
