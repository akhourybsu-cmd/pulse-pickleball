/**
 * PULSE Venue Communities — client feature flag.
 *
 * A venue community is an ordinary Pulse community whose identity, branding
 * and programming come from a venue record. The schema for it has existed for
 * a long time (`groups.venue_id`, `groups.is_venue_verified`, the
 * `venue_official` group type, and ~23 venue tables), but the feature was
 * explicitly retired: routes were stubbed to redirects and GroupDetail's accent
 * plumbing was fed a hard-coded null.
 *
 * Bringing it back is several slices of work — creation, branding, courts,
 * reservations, and folding `venue_events` into `group_events`. A half-restored
 * version reaching players would be worse than the current clean absence, so
 * everything venue-shaped stays behind this until the whole path works.
 *
 * OFF by default. Enable for local development only:
 *   VITE_VENUE_COMMUNITIES=on   (or `true` / `1`)
 *
 * What it must gate:
 *   • the "I'm a venue" option in community creation
 *   • venue branding on a community (falls back to standard Pulse chrome)
 *   • venue management surfaces, courts and reservations as they land
 *
 * Existing `venue_official` groups keep working when the flag is off — they
 * simply render as ordinary communities. The flag hides the venue LAYER, it
 * does not hide anyone's community.
 *
 * ---------------------------------------------------------------------------
 * ARCHITECTURE RULE — keep it simple, no parallel schema.
 *
 * A venue community is a Pulse community with a venue's face on it. It is NOT
 * a second app with its own data model. Venue programming therefore runs on the
 * SAME tables everything else uses:
 *
 *   • events         → `group_events` (+ `group_event_rsvps`). It already
 *                      carries `venue_id`, `court_id` and waitlists.
 *                      `venue_events` is legacy and is being folded in.
 *   • round robins    → the existing round robin events feature. No
 *                      venue-specific round robin tables, ever.
 *   • matches         → the existing matches table. No venue-specific match
 *                      tables, ever.
 *
 * Anything venue-shaped that looks like it needs its own events, round robins
 * or matches is a bug in the design, not a missing table. The venue layer only
 * ever adds identity (branding, staff, courts) on top of shared play data — so
 * a game played at a venue is the same row, and counts the same, as one played
 * anywhere else in Pulse.
 * ---------------------------------------------------------------------------
 */
export function isVenueCommunitiesEnabled(): boolean {
  const raw = (import.meta.env.VITE_VENUE_COMMUNITIES ?? "").toString().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}
