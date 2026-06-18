## Why your link preview looks wrong

Two things are happening in the screenshot:

1. **The little heart icon** next to "pulsepb.com" is not Lovable branding — it's the fallback icon iMessage shows when it can't render the OG image. Our `og:image` points to `/pulse-og.svg`, and most messaging apps (iMessage, WhatsApp, Messenger, Slack on mobile) **do not render SVG OG images**. They need PNG or JPG. So they fall back to a generic shape.
2. **The title** "PULSE - Pickleball Rating System" is outdated — the app is no longer just a rating tracker.

## Plan

### 1. Generate a real PNG OG image (1200x630)
Use the existing `public/pulse-og.svg` composition (cream background, PULSE wordmark, pulse beat, tagline, pulsepb.com footer) and render it as a branded **PNG** at 1200x630. Save to `public/pulse-og.png`.

This is what iMessage/WhatsApp/Slack will actually display — large, on-brand, no Lovable fallback.

### 2. Update `index.html` head tags
- **Title:** `PULSE — Play. Connect. Compete.` (or similar — see question below)
- **Description:** rewrite to reflect the current app: find events, join round robins, connect with players, run tournaments — not just "track your rating"
- **og:title / og:description:** match the above
- **og:image:** swap `/pulse-og.svg` → `/pulse-og.png` (+ update `og:image:type` to `image/png`)
- **twitter:image:** same swap
- Add `og:url` and `og:site_name` pointing at `https://pulsepb.com` / `PULSE`

### 3. Heads-up on cache
iMessage, WhatsApp, and friends cache link previews aggressively. The old preview will keep showing in existing threads until the platform re-scrapes. I'll mention this when shipped — users can force a refresh by sharing in a new thread or using each platform's debugger (e.g. Facebook Sharing Debugger).

## Out of scope
- Per-route OG tags (would need react-helmet-async wiring — happy to add in a follow-up if you want round-robin or group share links to have their own previews).
- Replacing the favicon — current `pulse-favicon.svg` is already on-brand.

## One question before I build

**What tagline do you want under the PULSE name?** Pick one or write your own:
- "Play. Connect. Compete." (broad, action-oriented)
- "The home for pickleball players and venues." (descriptive)
- "Find games. Join events. Build your pickleball community." (longer, more specific)
- Custom — tell me what to use.

This drives the title, description, and the text rendered into the new PNG OG card.