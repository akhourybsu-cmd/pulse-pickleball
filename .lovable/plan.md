## Goal

In the Record Match wizard's "Where did you play?" step, replace the free-text city/state/zip entry with an autocomplete that only accepts a real, verified city (or town) + state/region. Location stays optional.

## UX

- Section header stays "Where did you play? (optional)".
- Single search input: "Search city or town…" with a debounced dropdown of suggestions as the user types (e.g. "Brook" → "Brooklyn, NY, USA", "Brookline, MA, USA"…).
- User must pick a suggestion. Free-typed text that isn't selected from the list cannot be submitted — the input clears or shows "Pick a city from the list".
- Selected location renders as a confirmed card with a green check and an X to clear, e.g. `Brooklyn, NY ✓`.
- Recent locations (from `user_recent_locations`) still show above the search as one-tap chips — those are already verified picks from prior matches.
- "Skip — no location" is implicit: the user just leaves it empty and proceeds.

## Verification source

Use the **Google Maps Platform** connector (Places API New — Autocomplete + Place Details), restricted to city-level results:
- `includedPrimaryTypes: ["locality", "administrative_area_level_3", "postal_town"]`
- Returns canonical city, admin region (state/province), and country, so spelling and casing are always consistent.

Google Maps is not yet linked to this workspace. Before building, I'll prompt you to link it via the connector picker (one click — no API key handling on your end). If you'd rather not use Google, the fallback is OpenStreetMap Nominatim (free, no key, lower quality + rate-limited) — say the word and I'll swap.

## What gets stored

`formData.customLocation` keeps the same shape so nothing downstream changes:
- `name`: `"Brooklyn, NY"` (canonical, formatted from the Place result)
- `city`: `"Brooklyn"`
- `state`: `"NY"` (or region code/name for non-US)
- plus a new `placeId` field so repeat picks of the same city dedupe cleanly in `user_recent_locations`.

`locationId` stays `null` (no court linkage).

## Technical changes

1. **`src/components/match-wizard/steps/DateLocationStep.tsx`**
   - Remove the "Add new location" dialog with city/state/zip inputs.
   - Add a `<CityAutocomplete>` component (debounced 250ms, session token per search session).
   - Keep the Recent list and Today/Date controls unchanged.
   - Block "Next" unless either: nothing selected (skip) OR a verified pick exists.

2. **New `src/components/match-wizard/CityAutocomplete.tsx`**
   - Calls a new edge function `geocode-city-search` with `{ query, sessionToken }` → returns `[{ placeId, label, city, region, country }]`.
   - On select, calls `geocode-city-details` with `{ placeId, sessionToken }` → returns canonical fields, then updates `customLocation`.

3. **New edge functions** (`supabase/functions/geocode-city-search`, `geocode-city-details`)
   - Proxy to Google Maps Platform gateway (`places/v1/places:autocomplete`, `places/v1/places/{id}`).
   - Validate input with zod, enforce `includedPrimaryTypes` city filter, return only the minimal fields above.
   - Require an authenticated user (JWT check) so the connector key isn't burned by anonymous traffic.

4. **`user_recent_locations`**
   - No schema change required; `name` + `city` + `state` already exist. The new `place_id` is optional — I'll add a nullable `place_id text` column + unique `(user_id, place_id)` index so a city picked twice doesn't duplicate. (Migration runs before code that reads it.)

## Out of scope

- Court / venue picking (already removed from this step).
- International address parsing beyond city + region + country.
- Map preview UI.

## Open question

Confirm you're OK linking the Google Maps Platform connector for this. If yes, after you approve the plan I'll prompt the connector picker as the first build step, then ship the changes above.