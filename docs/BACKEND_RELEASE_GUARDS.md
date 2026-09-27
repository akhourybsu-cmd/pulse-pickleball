# PULSE backend release contract

Production is `rqfqwavhtfwwtmfjnxkx`. The only approved staging project is
`svdpujbstxiaunoeqlee`. These are separate projects; PULSE has no runtime or
deployment dependency on Lovable.

## Release checks

- `src/lib/backendPolicy.mjs` validates the project, exact HTTPS URL, and public
  key type. All app clients and direct REST calls use the validated config.
  Startup validates before loading auth/data clients and shows recovery controls
  when a configuration or startup failure prevents the app from loading.
- Vite validates every mode and both committed production env files. A restored
  old `.env` fails even if `.env.production` would otherwise hide the problem.
  Staging and development output go into `dist-staging` and `dist-development`;
  production alone writes `dist`.
- `npm run build` emits `backend-release.json` and checks the actual output for
  foreign/retired Supabase endpoints, missing or changed files, production mode,
  and revision. The manifest contains no credentials or account data.
- Firebase's predeploy hook repeats artifact validation. GitHub workflows check
  that the release is the current main commit and validate the public key against
  the approved project's auth endpoint. The backend workflow pins its target
  directly; changing a repository variable cannot redirect it.
- The Firebase workflow verifies the live manifest and every manifested file
  against the just-built release after deployment. A failed check marks the run
  failed; investigate it rather than automatically rolling back to an old build.
- `npm run cap:sync` validates both the web build and copied Android assets.
  Gradle also checks the native bundle before a direct Android Studio build.
  Remote `server.url` overrides and stale commit bundles are rejected. CI installs
  dependencies from the lockfile and checks main again before a Play upload.
- Every build stamps a distinct PWA service worker cache. Navigations and release
  metadata are never served from its asset cache. Native apps do not register the
  web service worker. Auth storage remains scoped to the backend project.

## Operational requirements

Require pull requests and the GitHub Actions `Build` check on main, including
administrator pushes. Disable force pushes/deletion. These are repository
settings, not settings this document or a workflow can enforce on its own.

Keep old generator integrations disconnected. An administrator who deliberately
removes checks, changes deployment credentials/settings, or reruns a historical
workflow that predates these guards can still bypass code-based protection.
Do not rerun old deployment workflows or restore old Hosting releases. Recover
by applying the needed code fix to current main and building it with these guards.

Existing native installations contain their original JavaScript bundle. A website
deployment cannot replace that bundle; publish and install a new native version.
This repository currently provides Android packaging; no iOS project is checked in.

For an intentional future backend migration, update the shared policy, both env
files, Supabase CLI config, workflow target, and migration tests together. Rehearse
auth/account linkage on approved staging first. Never change production settings
just to run a preview. Public publishable key rotation requires a successful
`npm run backend:health` release preflight; server keys are never accepted.

Useful checks:

```sh
npm run build
npm run backend:health
npm run cap:sync
node scripts/check-backend-artifact.mjs --native
node scripts/verify-live-backend.mjs
```

The live verification command expects `dist` to be the exact deployed build, not
a later local rebuild. The public `/backend-release.json` reports the deployed
revision and backend for diagnosis without requiring a sign-in.
