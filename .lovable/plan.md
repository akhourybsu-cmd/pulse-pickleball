## Edit Profile cleanup — mobile-first refactor

Strip the 5-tab strip and unnecessary fields, switch to a stacked, collapsible section layout, and remove duplicated areas.

### Layout changes

- Remove the 5-tab `TabsList`. Replace with a single vertical column of collapsible sections (shadcn `Accordion`, `type="multiple"`), each with an icon, title, and a small status chip ("Complete" / "Add details") on the right.
- Sections (in order):
  1. **Photo & Identity** — avatar upload + first/last/display name
  2. **Location** — city + state
  3. **Tournament info** — phone, date of birth, gender, self-rated skill
  4. **Play style** — home court, handedness, play side
- Keep `TournamentReadinessCard` (compact) inline at the top of the page below the header instead of in the header action slot, so it's tappable on mobile without crowding the title.
- Honor `?focus=` param by auto-opening the matching accordion section and scrolling to it (replaces current tab/scroll logic).

### Fields removed from the page

- `phonetic_name`
- `paddle_brand`, `paddle_model`
- `shirt_size`, `emergency_contact_name`, `emergency_contact_phone`
  - These stay in the DB; just stop rendering/sending them from Edit Profile. Tournament registration form already collects shirt size / emergency contact per event.

### Tabs removed entirely

- **Notifications tab** — replaced with a single row at the bottom: "Manage notification preferences →" linking to `/notifications/settings` (existing page).
- **Security tab** — replaced with a single row at the bottom: "Reset password" button (keeps existing `handleResetPassword` logic, no separate tab).

### Save behavior

Recommendation: **per-section save with a sticky footer fallback**.
- Each accordion section gets its own small "Save section" button in its footer that only commits that section's fields. Gives instant feedback on mobile without one giant form.
- Sticky bottom Save bar is **removed** (it overlaps the bottom nav on small phones and is redundant once sections save themselves).
- Cancel becomes a back arrow in the header (already provided by `PlayerPageHeader`).
- Name validation (first + last required) runs on the Identity section save.

### Files touched

- `src/pages/EditProfile.tsx` — remove tabs, add accordion, drop sticky save bar, drop removed-field state, add per-section save handlers, add links out for notifications/password.
- `src/components/profile/ProfileBasicsTab.tsx` — split into two leaner subsections (Identity, Location), remove phonetic name field, tighten mobile spacing (single column under `sm`, 8pt gaps).
- `src/components/profile/TournamentInfoTab.tsx` — remove shirt size + emergency contact fields and their grid rows. Keep phone, DOB, gender, self-rated skill.
- `src/components/profile/PlayStyleTab.tsx` — remove paddle brand/model fields. Keep home court, handedness, play side.
- `src/lib/profileCompleteness.ts` — drop removed fields from completeness scoring so the readiness ring doesn't perpetually show "incomplete".
- Delete imports of `NotificationsTab` and `SecurityTab` from EditProfile (files themselves left in place in case they're reused elsewhere — quick `rg` check during build to confirm).

### Out of scope

- No DB migrations. Columns stay; we just stop writing to them from this page.
- No changes to `/notifications/settings` or password-reset flow themselves.
- No visual redesign beyond mobile layout tightening (8pt spacing, single column, larger tap targets). Existing tokens and `Card` styling preserved.
