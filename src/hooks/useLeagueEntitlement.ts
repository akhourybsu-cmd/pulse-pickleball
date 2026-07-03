/**
 * Feature-gate hook for League Play on the player side.
 *
 * Stubbed to always return `entitled: true` — Leagues are free while
 * we build the muscle. When we ship the paid gate this hook is the
 * ONE place to flip:
 *   • return `false` for non-subscribers,
 *   • surface `reason` + `upgradeUrl` to the paywall dialog,
 *   • wire `loading` so the dashboard skeleton stays quiet during
 *     entitlement checks (Stripe / server-side).
 *
 * Every player-facing entry point to leagues (Dashboard card, Profile
 * row, "Join with code" action, /player/leagues route) should call
 * this and gate on it — so when the gate flips, the whole surface
 * flips together and we can't ship a half-gated experience.
 */
export interface LeagueEntitlement {
  entitled: boolean;
  loading: boolean;
  /** Human-readable reason for a false entitlement (paywall copy). */
  reason: string | null;
  /** Where to send the player if they want to upgrade. */
  upgradeUrl: string | null;
}

export function useLeagueEntitlement(): LeagueEntitlement {
  return {
    entitled: true,
    loading: false,
    reason: null,
    upgradeUrl: null,
  };
}
