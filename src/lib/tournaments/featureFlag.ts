/**
 * PULSE Tournaments — client feature flag.
 *
 * Tournament mode is under active reconstruction: the codebase carries two
 * generations of half-finished tournament UI and schema, and the consolidated
 * product is not ready for anyone — not players, not organizers, not other
 * admins. This flag is the single kill switch that keeps ALL of it invisible
 * while it's being built.
 *
 * OFF by default. Enable for local development only:
 *   VITE_TOURNAMENTS=on   (or `true` / `1`)
 *
 * What it must gate (defense in depth — the router alone is not enough):
 *   • every /tournaments/*, /tournament/*, /tournament-admin/* route
 *     (unregistered when off, so the URLs 404 instead of rendering)
 *   • every entry point that links to them (admin nav, admin dashboard tile,
 *     the archive page)
 *   • tournament rows surfacing in player-facing event discovery
 *
 * Note this is deliberately independent of AdminGuard. The routes are already
 * admin-only, but "admin-only" is not "invisible" — this flag is what makes it
 * invisible.
 */
export function isTournamentsEnabled(): boolean {
  const raw = (import.meta.env.VITE_TOURNAMENTS ?? "").toString().toLowerCase();
  return raw === "on" || raw === "true" || raw === "1";
}
