# FAQ Hard Pass

The current `/faq` page is stale: it links to routes that no longer exist (`/new-match`, `/match-history`, `/round-robin`, `/court/connector`), still talks about "Court Connector" (replaced by Community / Groups), and never mentions tournaments, venues, friends/DMs, or the player/venue mode split. The hero also uses a hardcoded green (`#A9DC3D`) and a separate logo image instead of the sticky PULSE top bar used on every player page.

## Goals
- Every answer reflects the app as it exists today.
- Every "where do I find this?" instruction is correct, step by step, and uses the real navigation labels.
- Same sticky PULSE header (cream `Logo` on `bg-secondary`, back button) as the rest of the player surface.
- Wording dropped one reading level: short sentences, plain verbs, no jargon unless we define it.

## Header + visual pass
- Replace the custom `<nav>` + hero block with the standard player sticky header (back button + `Logo` + theme toggle), then a compact in-page `PlayerPageHeader` row (HelpCircle icon, "Help Center", one-line subtitle, accent underline).
- Remove the hardcoded `#A9DC3D` and inline gradients; use semantic tokens (`text-primary`, `bg-primary/10`, `border-primary`).
- Keep the accordion pattern but tighten cards: white card surface, lime left accent, 8pt spacing (`p-4`, `gap-3`, `space-y-4`), no double borders.
- Add a sticky in-page anchor strip under the header so people can jump to a section (Getting Started / Ratings / Matches / Play / Community / Venues / Account).

## Content rewrite — new section list
Sections are reordered around how a real player uses the app, not around internal subsystems.

### 1. Getting Started
- What is PULSE? (one-paragraph: discover venues, log matches, build a rating, join events, message friends)
- Player mode vs. Venue mode — what each is for, how to switch (Mode Switcher in the top bar, only visible if you manage a venue)
- The five player tabs at the bottom: Home, Matches, Community, Profile, plus the floating "Record Match" button
- How to set up your profile (Profile tab → Edit Profile → first name, last name, rating-eligible info)

### 2. Your Pulse Score (rating)
Keep the existing rating explanations — they're accurate — but trim:
- "What's a Pulse Score?" (1 short paragraph)
- "How is it calculated? (Simple)" — the ✅/❌ block, unchanged in substance
- "When are ratings calculated?" — weekly freeze, Monday recalculation
- "Provisional players" — under 8 matches, faster movement
- Collapse the 6-step formula and worked example into one "Show me the math" accordion (kept for power users, hidden by default)

### 3. Recording & Managing Matches
- How to record a match — Home / Matches / Play → tap the green **Record Match** button → pick 4 players → enter score → choose match type → submit
- Where to see match history — Matches tab (route: `/player/matches`)
- How to verify or contest a match — Matches tab → tap a match → "Verify" or "Contest"
- Guest players — how to add someone who isn't on PULSE yet

### 4. Play: Round Robins, Tournaments, Open Play
- What's the Play hub for? (one place for round robins, tournaments, drop-in)
- Joining a round robin — Play tab → Find Events → tap event → Register
- Hosting your own round robin — Play tab → Create Round Robin → wizard
- Kiosk mode — open the event → "Open Kiosk" (full-screen, tablet/TV view)
- Tournaments — discover at `/player/find`, register on the single-page registration screen, view bracket on the tournament page

### 5. Community: Groups, Friends, Messages
- What replaced Court Connector? — Community Hub (Groups, Feed, LFG, Highlights, Announcements)
- Joining or creating a group — Community tab → Groups → Browse or Create
- LFG (Looking for Game) — Community → LFG → New Post
- Adding friends — Profile or player card → "Add Friend"
- Direct messages — Community → Messages, or tap a friend → Message

### 6. Venues & Booking
- Finding venues near you — Home → "Find Venues" or `/player/venues`
- Following a venue — venue page → Follow (you get their announcements + events)
- Booking a court — venue page → Book a Court → pick court/time → confirm
- Registering for venue events / coaching / lessons — venue page → Events tab

### 7. Account, Notifications, Privacy
- Notifications — bell icon, top right; tune them in Profile → Notification Preferences
- Privacy — what other players can see (profiles_public surface); how to block someone
- Biometric sign-in setup (Profile → Security)
- Switching to dark mode — sun/moon icon in the header
- Sign out — Profile tab → Sign Out

## Stale things to delete
- All `/match-history`, `/new-match`, `/round-robin`, `/court/connector` links → replace with `/player/matches`, `/player/matches/new`, `/player/play`, `/player/community`.
- "Court Connector" terminology everywhere (rename to Community / Groups / LFG depending on what's actually being described).
- The hardcoded `#A9DC3D` and the bespoke gradient hero in favor of design tokens.

## Out of scope
- No new backend, no schema, no data fetching — this is a pure content + styling pass on `src/pages/FAQ.tsx`.
- Not adding search-in-FAQ this round (can be a follow-up if you want it).

## Open questions before I build
1. Do you want me to keep the deep "Show me the math" / worked-example accordion at all, or drop it entirely since most players don't care?
2. Should the FAQ stay at `/faq` (public, signed-out OK), or move under `/player/help` so it inherits the bottom nav?
