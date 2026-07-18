# Friend discovery by location (2026-07-16)

Adds opt-in, distance-ranked "Nearby" friend discovery on top of the existing
network-scoped connect flow, plus a crisper shared search field across the
friend menus.

## Trust / privacy model (important)

Location discovery introduces a **new** trust model versus the rest of Connect
(which never had a public directory — you only see people you've crossed paths
with). It is deliberately conservative:

- **Opt-in.** A player is only ever surfaced by location when they set
  `discoverable_by_location = true` in their profile. Default is off.
- **Reciprocal.** `discover_players_nearby` returns nothing unless the *caller*
  is themselves discoverable and has coordinates set — seeing nearby players and
  being seen are the same switch.
- **Coarse exposure.** Raw lat/lng is never returned to clients and never added
  to `profiles_public`. The RPC (SECURITY DEFINER) returns only a city label +
  a rounded distance.
- **Excludes existing connections.** Self and anyone already in a `friendships`
  row (pending / accepted / blocked, either direction) are filtered out.

## What shipped

### DB — `20260716220000_profile_location_discovery.sql`
- `profiles`: `location_name`, `location_place_id`, `location_lat`,
  `location_lng`, `location_updated_at`, `discoverable_by_location`
  (bool, default false). Partial index on coords for opted-in rows.
- `discover_players_nearby(_radius_km double precision default 40, _limit int
  default 30)` — haversine distance, opt-in + reciprocity gated, excludes
  friendships, ordered by distance then rating. Granted to `authenticated`,
  revoked from anon/public.

### Geocoder — `geocode-city-search`
- `details` action now returns `latitude`/`longitude` (added `location` to the
  Places FieldMask). Backward compatible (null when absent).

### Client
- `CityAutocomplete` / `VerifiedCity` carry optional `latitude`/`longitude`.
- **EditProfile → Location**: a "Let nearby players find me" switch plus a
  verified home-city picker (stores name/place_id/lat/lng), on top of the
  existing free-text town/state (unchanged). Its own section save.
- `useNearbyPlayers` hook + a **Nearby** tab in `ConnectSheet` showing city +
  distance (miles) per row, with distinct states: loading, not-enabled (CTA to
  the profile location section), empty, and — if the RPC/columns aren't deployed
  yet — a graceful "not available yet" fallback (never throws).
- Shared `SearchField` (from the earlier pass) is used across ConnectSheet,
  MessageFriendPickerSheet, and FriendsTab.

## Verification
- `tsc` clean, 39 unit tests pass, `vite build` succeeds, changed files lint
  clean. New RPC + columns are cast at the call sites because the generated
  Supabase types predate the migration — regenerate types after deploy to drop
  the casts.

## Live-DB deploy + verify gap
The migration and the geocoder change can't be exercised here (no Supabase
project / Deno). Before relying on Nearby in production:
1. Apply `20260716220000_profile_location_discovery.sql`.
2. Redeploy `geocode-city-search` (now requests `location`).
3. Regenerate `src/integrations/supabase/types.ts` and remove the temporary
   casts in `useNearbyPlayers.ts` and `EditProfile.tsx`.
4. Smoke test: two opted-in profiles with nearby home cities see each other in
   Connect → Nearby with a sensible distance; a non-opted-in caller sees the
   enable-CTA; raw lat/lng never appears in any client response.

## Open follow-ups
- Distance-unit preference (miles hard-coded; could follow locale).
- Optional radius control in the Nearby tab.
- Consider folding "Plays at your venue" as a second proximity signal once a
  home-venue concept exists.
