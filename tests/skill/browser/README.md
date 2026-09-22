# Local assessment preview

From the repository root:

```powershell
node node_modules/vite/bin/vite.js --config tests/skill/browser/vite.config.ts --host 127.0.0.1 --port 5198
```

Open [the preview](http://127.0.0.1:5198/tests/skill/browser/index.html).

This renders the production assessment page, hook, question card and result components against a local-storage Supabase adapter. It makes no backend requests. Use the toolbar to inspect all 64 scenarios, simulate a failed save, seed a completed questionnaire, reset preview data or constrain the layout to phone width. Reload to verify draft resume.

Checks exercised: unselected answer cannot continue; keyboard slider; failed save retains selection; retry advances once; reload resumes; review/edit preserves the update; completion calls the authoritative pure core; result discloses evidence; retake clears answers; animation play/pause; no horizontal overflow at 390px. The backend adapter does not validate RLS, real JWT authorization, network latency or concurrent server transactions.
