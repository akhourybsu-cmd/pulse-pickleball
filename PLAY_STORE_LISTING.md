# PULSE — Google Play store listing copy

Paste-ready text for the Play Console **Main store listing** page. Fill in the
asset checklist at the bottom before you submit. All character counts are the
Play limits Google enforces on each field.

---

## App name (≤30 chars)

```
PULSE: Pickleball
```

Alternatives if that name is taken:
- `PULSE Pickleball` (16)
- `PULSE — Play Pickleball` (23)

## Short description (≤80 chars)

```
Find games, track matches, join leagues, and connect with pickleball players.
```

(77 chars.) Alternatives:
- `Your pickleball home: matches, leagues, ratings, and a local community.` (71)
- `Play more pickleball. Track matches, run leagues, and meet nearby players.` (74)

## Full description (≤4000 chars)

```
PULSE is the all-in-one home for your pickleball life. Whether you play casual
open-play, run a competitive league, or just want to find people to hit with,
PULSE keeps your games, your stats, and your community in one place.

FIND YOUR NEXT GAME
• Discover players near you and send a friend request in a tap.
• Join community groups for your local courts and open-play sessions.
• See who's around and message players directly to set up a match.

TRACK EVERY MATCH
• Record match scores in seconds with a guided, mobile-first flow.
• Keep a running history of who you've played and how you did.
• Watch your rating move as you log real games.

KNOW YOUR LEVEL
• Take the Skill Fingerprint self-assessment to find your starting rating.
• Get a rating that updates from your actual match results, not guesswork.
• Understand exactly who a league or group is for before you join.

RUN AND JOIN LEAGUES
• Round robins and ladder leagues with automatic scheduling.
• Live standings that update as scores come in.
• Request a substitute, handle sit-outs, and keep a season running smoothly.
• Organizer tools for rosters, sessions, and results — no spreadsheets.

COMPETE IN TOURNAMENTS
• Bracket play with clear, easy-to-follow match views.
• Follow your progress round by round.

STAY CONNECTED
• A unified inbox for group chats and direct messages.
• Friend requests, presence, and a friends list so you always know who's on.
• Get notified about new activity, invites, and messages that matter to you.

Built by players, for players. PULSE works great on your phone and keeps
working when the signal drops. Create a free account and get on the court.

Questions or feedback? Reach us at support@pulsepb.com.
```

> Trim any section above to fit if you add more. Keep the leading one-liner and
> the closing support line — Google's reviewers and users both scan those first.

## Release notes / "What's new" (≤500 chars per release)

**v1.0.0 — first release:**

```
Welcome to PULSE! 🎾

Find players near you, track your matches, and watch your rating climb. Join
round-robin and ladder leagues with live standings, compete in tournaments,
and chat with your pickleball community — all in one app.

This is our first release. We'd love your feedback: support@pulsepb.com
```

(Under 500 chars.) For later updates, keep it short and user-facing — what
changed and why they'll care, not internal version details. Template:

```
What's new in this update:
• <headline improvement>
• <fix or smaller win>

Questions? support@pulsepb.com
```

---

## Categorization & contact

| Field | Value |
|---|---|
| **App category** | Sports |
| **Tags** | pickleball, sports, community, fitness |
| **Contact email** | support@pulsepb.com |
| **Website** | https://pulsepb.com |
| **Privacy policy URL** | https://pulsepb.com/privacy |

> The privacy policy and account-deletion pages ship inside the app at
> `/privacy`, `/terms`, and `/delete-account`. Once the domain points at the
> deployed site, `https://pulsepb.com/privacy` and
> `https://pulsepb.com/delete-account` are the public URLs Google requires.

---

## Data safety form (answers to prep before filling Google's wizard)

PULSE uses Supabase (auth, database, storage) as its backend. Answer the Data
safety questionnaire based on what the app actually collects:

- **Account info** — name, email, profile details, skill rating: *collected*,
  used for **App functionality** and **Account management**. Linked to the user.
- **Location** — approximate city (for "players near you"): *collected* only if
  the user opts in by setting a location. Used for **App functionality**. Linked
  to the user. Not shared with third parties for ads.
- **Messages** — group chat and direct messages: *collected*, used for **App
  functionality**. Linked to the user.
- **App activity** — matches, standings, in-app actions: *collected*, used for
  **App functionality** and **Analytics**.
- **Data is encrypted in transit:** Yes.
- **Users can request data deletion:** Yes — in-app at `/delete-account`, which
  permanently deletes the account and profile.
- **No data is sold.** No data shared for third-party advertising.

> Confirm each row against the current schema before submitting — the Data
> safety declaration is a legal attestation.

---

## Content rating

Run Google's IARC questionnaire. Expected outcome for PULSE: **Everyone**, with
a note that the app contains **user-generated content / user-to-user
communication** (chat + community posts). Answer "yes" to the
user-communication question so the rating reflects the chat feature.

---

## Asset checklist (upload in Play Console)

- [ ] **App icon** — 512×512 PNG, 32-bit, ≤1 MB. (Source: `public/` PULSE mark.)
- [ ] **Feature graphic** — 1024×500 PNG/JPG (no alpha). Brand ink background +
      PULSE logo + tagline "Play more pickleball."
- [ ] **Phone screenshots** — 2–8, 16:9 or 9:16, min 320px on the short side.
      Suggested set (grab on-device from the debug APK):
      1. Dashboard / home
      2. Record-a-match flow
      3. League standings (round robin or ladder)
      4. Skill Fingerprint result
      5. Social inbox / friends
- [ ] **(Optional) 7-inch & 10-inch tablet screenshots** — only if you list
      tablet support.

> Tip: capture screenshots from the installed debug APK on your device so the
> status bar, safe-area insets, and native chrome look exactly like production.
