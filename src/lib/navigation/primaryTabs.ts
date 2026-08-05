/**
 * The single authoritative definition of PULSE's five primary bottom-nav
 * tabs and the directional logic that drives horizontal tab transitions.
 *
 * Everything about "which tab is this route" and "which way do we slide"
 * lives here — the bottom nav (PlayerShell) and the page-transition wrapper
 * (PrimaryTabTransition) both read from this module so tab order is never
 * duplicated or allowed to drift.
 *
 * Pure and framework-free (no React) so the direction rules can be unit
 * tested in the node test environment without a DOM.
 */

export interface PrimaryTab {
  /** Canonical root path — used for nav links and as the slide animation key. */
  readonly path: string;
  readonly label: string;
}

/**
 * Ordered left → right exactly as they appear in the bottom navigation.
 * The index in this array IS the tab's horizontal position, which is what
 * the slide direction is derived from.
 *
 * NOTE on Leagues: it is a nav tab (so the bar highlights it and it's one
 * tap away) but its subtree keeps its OWN transition outlet — navClassification
 * classifies /player/leagues as "league", not "primary", so it never joins the
 * lateral tab-slide domain. That split is intentional: this module owns the
 * highlight; the league outlet owns the motion. The Leagues tab is also
 * entitlement-gated at render time (PlayerShell filters it out when a player
 * isn't league-entitled) — this array stays canonical so deep links still
 * resolve the tab regardless.
 */
export const PRIMARY_TABS: readonly PrimaryTab[] = [
  { path: "/player/dashboard", label: "Home" },
  { path: "/player/matches", label: "Matches" },
  { path: "/player/leagues", label: "Leagues" },
  { path: "/player/social", label: "Social" },
  { path: "/player/community", label: "Community" },
  { path: "/player/profile", label: "Profile" },
] as const;

/** Segment-aware prefix match: `/a` matches `/a` and `/a/b`, never `/ab`. */
function ownsPath(base: string, pathname: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * True when `pathname` belongs to the tab at `tabPath`. Encodes the two
 * aliases the product uses: the Social tab owns direct messages and the
 * friends surface too; every other tab owns its own subtree.
 */
function tabOwns(tabPath: string, pathname: string): boolean {
  if (tabPath === "/player/social") {
    return (
      ownsPath("/player/social", pathname) ||
      ownsPath("/player/friends", pathname) ||
      ownsPath("/player/messages", pathname)
    );
  }
  return ownsPath(tabPath, pathname);
}

/**
 * Index of the primary tab that owns `pathname`, or -1 when the route is
 * not one of the five primary areas (detail pages, leagues, play, etc.).
 */
export function primaryTabIndex(pathname: string): number {
  for (let i = 0; i < PRIMARY_TABS.length; i++) {
    if (tabOwns(PRIMARY_TABS[i].path, pathname)) return i;
  }
  return -1;
}

/** Root path of the owning primary tab, or null when not a primary route. */
export function primaryTabPath(pathname: string): string | null {
  const i = primaryTabIndex(pathname);
  return i >= 0 ? PRIMARY_TABS[i].path : null;
}

/** Convenience predicate. */
export function isPrimaryTabPath(pathname: string): boolean {
  return primaryTabIndex(pathname) >= 0;
}

/**
 * Horizontal slide direction between two primary-tab indices:
 *   +1  destination is to the right  → enters from the right
 *   -1  destination is to the left   → enters from the left
 *    0  same tab, or either side is not a primary tab → no page transition
 *
 * Works for multi-tab skips (e.g. Home → Community) because it compares
 * positions directly rather than stepping through intermediate tabs.
 */
export function slideDirection(prevIndex: number, nextIndex: number): -1 | 0 | 1 {
  if (prevIndex < 0 || nextIndex < 0) return 0;
  if (nextIndex === prevIndex) return 0;
  return nextIndex > prevIndex ? 1 : -1;
}
