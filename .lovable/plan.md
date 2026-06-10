# Add Google & Apple Sign-In

Enable managed OAuth (Google + Apple) on the existing `/auth` page so players can sign in/up with one tap. Email/password stays as the default; this adds social options above it.

## Changes

1. **Enable providers in Lovable Cloud**
   - Turn on Google and Apple via the social auth configuration tool. Uses Lovable Cloud's managed credentials — no Apple Developer or Google Cloud setup needed from you. Email auth stays enabled.
   - This installs `@lovable.dev/cloud-auth-js` and generates `src/integrations/lovable/`.

2. **Update `src/pages/Auth.tsx`**
   - Add two buttons at the top of the auth card (above the email field, hidden on the forgot-password and MFA views):
     - "Continue with Google" (Google G icon)
     - "Continue with Apple" (Apple logo icon)
   - Divider: "or continue with email"
   - On click: call `lovable.auth.signInWithOAuth("google" | "apple", { redirect_uri: window.location.origin + redirectPath })`. Handle `result.error` with a toast; if `result.redirected`, return; otherwise navigate to `redirectPath`.
   - Persist the `pulse_persist_session` preference before invoking OAuth so the session storage choice still applies.
   - Keep existing biometric / password / signup logic untouched.

3. **Post-auth profile handling**
   - Existing `profiles` trigger creates rows from `auth.users` metadata. OAuth users won't have `first_name` / `last_name` / `state` from the form, so `AuthGuard` (`requireActive`) will route them to `/onboarding/profile` to complete required fields — no schema changes needed.

## Out of scope
- Bring-your-own Apple/Google credentials (managed credentials used).
- Native Sign in with Apple via Capacitor (web OAuth flow works inside the Capacitor webview; native plugin can be added later if desired).
- Linking existing email accounts to a social identity.
