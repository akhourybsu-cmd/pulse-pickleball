## Diagnosis
The push plumbing is in place — service worker registered, VAPID keys configured both client (`VITE_VAPID_PUBLIC_KEY`) and server (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_CONTACT`), `push-send` edge function deployed, dispatch trigger live on `user_notifications`.

But `push_subscriptions` is empty for every user — meaning **no device has ever tapped "Enable push"**. The toggle only exists buried at `/settings/notifications`, so notifications create rows in `user_notifications` (bell icon works) but never deliver a web push.

There's also a platform gotcha worth surfacing in-app: **iOS Safari requires the site to be installed to the Home Screen first** before it'll allow web push at all. Plain Mobile Safari will not show a "Allow notifications" prompt.

## Plan

### 1. Surface a "Turn on notifications" prompt where users will see it
- Add a dismissible banner at the top of the player dashboard (`Dashboard.tsx`) that shows when:
  - `usePushSubscription` reports `supported && state === "disabled"` (not denied, not already enabled)
  - User hasn't dismissed it in this session (localStorage flag)
- Banner copy: "Get notified about new posts, friend requests, and messages." → **Enable** button calls `enable()` from the hook.
- On iOS Safari (not standalone PWA), show different copy: "Install PULSE to your Home Screen first to enable notifications" with a short how-to (Share → Add to Home Screen). Detect via `navigator.standalone === false && /iPad|iPhone|iPod/.test(navigator.userAgent)`.
- On denied state, show: "Notifications are blocked. Enable them in your browser settings."

### 2. Make the existing settings page more findable
- Add a quick link/button in the banner: "Manage in settings →" that goes to `/settings/notifications`.

### 3. Verify after enable
- Once the user taps Enable and grants permission, the hook upserts into `push_subscriptions`. I'll then immediately fire a test push via `push-send` so they get an OS notification on the spot confirming it works.

### 4. Improve the SW push payload safety
- Minor: the current SW push listener already handles the payload shape `push-send` emits (`title`, `body`, `url`, `tag`, `priority`). Leave it as-is.

### Technical notes
- New component: `src/components/dashboard/EnablePushBanner.tsx`
- No backend changes — fix is purely client-side UX so the subscription actually gets registered.
- No new dependencies.

## What you'll need to do
- On **Android Chrome** or **desktop Chrome/Edge**: just tap the new "Enable" banner → grant permission → I'll fire a test push.
- On **iPhone Safari**: first install PULSE (Share → Add to Home Screen), then **open the installed app from the home screen**, then tap Enable. iOS will only show the permission prompt inside the installed PWA.

Reply once you've tapped Enable on a device and I'll send the test push.