# Firebase Hosting cutover

This runbook moves the PULSE web frontend from its current host to Firebase Hosting. Supabase remains the backend. The domain stays registered and DNS-managed at GoDaddy.

## Safety rule

Do not remove the existing `pulsepb.com` A record or cancel the current host until the Firebase `web.app` deployment has passed functional checks. The DNS change is the final cutover step.

## 1. Enable Firebase Hosting

1. Add Firebase to Google Cloud project `pulse-pickleball-c60e1`.
2. Enable standard Firebase Hosting for the project. This is a static Vite application; Firebase App Hosting is not required.
3. Deploy the current build to the default `pulse-pickleball-c60e1.web.app` site.

## 2. Configure GitHub deployment

1. Create a least-privilege Firebase deployment service account for the project.
2. Add its JSON credential to the GitHub repository as the Actions secret `FIREBASE_SERVICE_ACCOUNT`.
3. Add the repository variable `AUTO_FRONTEND_DEPLOY=true` only after the first manual deployment passes testing.
4. Run the `Deploy frontend to Firebase Hosting` workflow manually once.

## 3. Pre-cutover verification

Test the generated `web.app` URL on desktop and mobile:

- direct navigation and hard refresh on nested routes such as `/player/dashboard`
- email/password sign-in and sign-out
- Google sign-in and return to the dashboard
- password reset link and redirect
- image uploads and downloads
- venue pages, ELEVENO chat, posts, events, and administration
- round-robin creation, joining, scoring, and realtime updates
- PWA installation, refresh behavior, and push subscription
- Supabase Edge Function calls and transactional email

## 4. Prepare authentication URLs

Before changing DNS:

1. In Supabase Authentication URL Configuration, set the Site URL to `https://pulsepb.com` and allow `https://pulsepb.com/**`, `https://www.pulsepb.com/**`, the Firebase test URL, and local development URLs.
2. Keep Google's OAuth redirect URI pointed at the Supabase callback URL. Ensure `https://pulsepb.com` and `https://www.pulsepb.com` are authorized JavaScript origins for the web OAuth client.
3. Verify auth email templates use the redirect target rather than a retired host URL.

## 5. Connect the GoDaddy domain

1. Add `pulsepb.com` and `www.pulsepb.com` in the Firebase Hosting custom-domain wizard.
2. Add Firebase's exact TXT ownership-verification records in GoDaddy without removing the live A record.
3. After verification, lower the TTL on the existing web records if GoDaddy permits it.
4. During the agreed cutover window, replace only the web-serving A/CNAME records with the exact records Firebase provides. Preserve MX, SPF, DKIM, DMARC, Supabase, Resend, and other unrelated records.
5. Wait for Firebase SSL provisioning and confirm both apex and `www` use HTTPS. Configure one hostname to redirect to the other.

## 6. Post-cutover observation

For at least 48 hours:

- monitor Firebase Hosting usage and GitHub deployment failures
- repeat authentication, upload, realtime, and deep-link checks
- confirm no browser requests or redirects reference the retired host
- keep the old hosting project available for fast DNS rollback

After the observation period passes, remove the old host's domain mapping and cancel its paid plan. Keep the GitHub repository and Supabase backups; neither depends on the retired host.
