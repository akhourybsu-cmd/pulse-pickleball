# Fix guest match submission

## Short answer on writing changes

Yes — I can still write and change app code normally. What I cannot do right now is touch your database directly: the saved connection password is rejected ("password authentication failed"), and the built-in database tools still point at the retired Lovable Cloud instance.

## What I confirmed about guest matches

Submitting a match with a guest does this, in order:

1. Create the match record.
2. Read your saved guests to reuse a matching name.
3. Create any missing guest.
4. Add all players (real and guest) to the match.

Steps 2 and 3 both touch the guest table — and on the migrated backend every signed-in read or write of that table takes 6–9 seconds and frequently times out, even though it holds only 39 guests. Anonymous reads of the same table are instant. So a match with a guest either hangs or fails, usually after the match row has already been created, which leaves a half-saved match behind.

The exact database rule causing that cost is not yet confirmed — a per-row security rule on the guest table is the leading suspect, but an insert being equally slow also points at a trigger or an invalid index. Confirming it is the first step, not an assumption.

## Plan

1. **Regain database access.** Reset the database password in your Supabase project (Project Settings → Database → Database password) and paste me the full connection string. Everything below then happens end to end from here. If you prefer not to, I hand you the SQL and you run it.
2. **Confirm the cause.** Run the timing/plan diagnostics against the guest table as a signed-in role: list its security rules, check for invalid indexes, look for triggers, and read the query plan that shows where the seconds go.
3. **Apply the targeted database fix.** Depending on what step 2 shows, that is one of: replacing the expensive per-row rule with a fast helper-function version, adding the missing index the rule depends on, rebuilding an invalid index, or removing/repairing a slow trigger. Then re-time the same reads and writes and confirm they are sub-100ms.
4. **Make guest submission resilient in the app.** Independent of the database fix: resolve/create guests *before* creating the match row so a failure can't leave an orphan match, and roll back the match if adding players fails. Surface a clear message instead of a silent spinner.
5. **Verify on the live site.** Sign in as a throwaway test account on pulsepb.com, submit a doubles match with one new guest and one existing guest, confirm both resolve to the right guest records and the match appears with correct names. Remove the test data afterwards.

## Technical notes

- Guest resolution lives in `src/components/match-wizard/MatchWizardContainer.tsx` (`handleSubmit`, steps 2–4): a `guest_players` select filtered on `created_by`, then a batch insert, then `match_participants`.
- Step 4 reorders that to: resolve guests → insert `matches` → insert `match_participants`, with a compensating delete of the match row on participant failure.
- The diagnostic queries already drafted live in `supabase/diagnostics/guest-players-timeout.sql`.
- Separate, already-known issue not addressed here: this project's Lovable preview binding still points at the old backend, so preview-based testing of signed-in flows isn't reliable; live-site testing is used instead.
