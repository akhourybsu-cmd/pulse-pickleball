## Scope
Four small, related changes — all UI/wording plus one tiny RR data capture tweak. No schema changes.

---

### 1. Admin Match History wording (`src/pages/AdminMatches.tsx`)
- Match row label: `"Venue:"` → `"Location:"` (line 400).
- Remove the `"Not an official community court"` italic note entirely (lines 402–406). Just show whatever `court_name` / `other_location` resolved to, no qualifier.
- Filter dropdown still functions, but rename the label/placeholder from `"Venue"` / `"All venues"` to `"Location"` / `"All locations"` (lines 358–363) and update the CSV header `"Venue"` → `"Location"` (line 253) so the admin side stops referencing "court" as a tracked entity.
- The filter options `"official"` / `"other"` keep their logic (they're the only way to distinguish community-court rows from free-text rows under the hood), but the visible labels become `"Community location"` / `"Custom location"`.

### 2. Remove "Most Played" court card from the home screen
- `src/pages/Dashboard.tsx`: delete both `<StatsByCourtCard userId={user?.id} />` usages (lines 314 and 420) and drop the unused import on line 22.
- Leave `StatsByCourtCard.tsx` and `DashboardModuleSkeleton`'s reference comment in place (no other consumers, but keeping the file avoids touching unrelated code). If you'd rather fully delete the component file too, say so and I'll include it.

### 3. Player-side parity for "not an official community court"
- Quick sweep with ripgrep for any remaining `"Not an official community court"` / `"official community court"` strings outside Admin. Current search shows the only live occurrence is in `AdminMatches.tsx`, so step 1 covers it. If the sweep surfaces anything else (e.g. match detail, match ticket), strip the same phrasing there.

### 4. Round Robin — capture & display town/city
The wizard's "Location" today is a court dropdown that stores a court UUID in `round_robin_events.location`. That's why city/town never shows up on the match card. Two-part fix, no migration needed (the `location` column already accepts free text):

- **DetailsStep (`src/components/round-robin/wizard/steps/DetailsStep.tsx`)**: keep the existing court Select, but add a sibling text input directly below it labeled `"Town or city (shown on the match card)"`. Persist into a new wizard field `formData.locationLabel`.
- **WizardContainer (`src/components/round-robin/wizard/WizardContainer.tsx`)**: 
  - Add `locationLabel: ""` to initial state and type.
  - When saving, prefer the free-text label for `round_robin_events.location` if provided; otherwise fall back to the court name (resolved from `locationId`) so the column always holds a human-readable string, not a UUID. Keep `venue_id` / `custom_location` writes intact for the unified-events sync.
- **ReviewStep**: show the resolved label in the "Location" row.
- **RoundRobinDetail control center**: add an inline "Edit location" affordance in the host hero (`RoundRobinHostHero.tsx`) that opens a small prompt/sheet to update `round_robin_events.location` post-creation, so existing events (like the test one) can be backfilled by the host without re-running the wizard.
- **Match card display**: wherever an RR match card renders the venue/location line (host hero subtitle and any player-facing event card), use `event.location` directly now that it's guaranteed to be a readable string. No changes needed if those components already render `event.location` — they will just start showing the new value.

---

### Out of scope
- No DB schema changes, no RLS changes, no edge-function changes.
- Court entity itself (`courts` table, court detail pages, CourtStats analytics elsewhere) is untouched — only the home-screen card and admin-history wording.
- Round Robin scheduling / rounds logic untouched.

### Verification
- Admin > Match History: label reads "Location", italic note gone, filter + CSV say "Location".
- Home screen (`/app/home`): no "Most Played" pill in either layout column.
- New RR via wizard with a town typed in → match card on the host hero shows that town. Existing RR → host can edit location inline and it appears on the card.