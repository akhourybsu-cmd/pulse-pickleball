# PULSE Pickleball

PULSE is a Vite, React, TypeScript, Tailwind CSS, Capacitor, and Supabase application for pickleball players, venues, leagues, tournaments, and communities.

## Local development

Requirements: Node.js 20 and npm.

```sh
npm ci
npm run dev
```

The browser app is served at `http://localhost:8080` by default.

## Verification

```sh
npm run build
npm run test
```

## Architecture

- Frontend: Vite/React static application
- Backend, authentication, database, storage, and Edge Functions: Supabase
- Source control and deployment automation: GitHub Actions
- Web hosting: Firebase Hosting
- Native packaging: Capacitor for Android and iOS

## Web deployment

Firebase Hosting serves the compiled `dist/` directory. Production deployments from `main` are controlled by `.github/workflows/firebase-hosting-deploy.yml` and the `AUTO_FRONTEND_DEPLOY` repository variable.

Before enabling automatic deployment, configure the `FIREBASE_SERVICE_ACCOUNT` GitHub Actions secret and complete the steps in `docs/FIREBASE_HOSTING_CUTOVER.md`.

Manual local deployment, after authenticating the Firebase CLI:

```sh
npm ci
npm run build
npx firebase-tools deploy --only hosting --project pulse-pickleball-c60e1
```

## Mobile builds

```sh
npm run cap:sync
npm run android:open
```

Release builds bundle the generated `dist/` assets and do not rely on a remote preview server.
