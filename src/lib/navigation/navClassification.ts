/**
 * Navigation classification for the player shell's content region.
 *
 * One place decides what KIND of transition a route change is, so the shell
 * content wrapper never has to infer behavior from ad-hoc string comparisons
 * (and never treats "a longer URL" as automatically "deeper"). The five
 * primary tabs move laterally; genuine detail routes push forward/back; and
 * everything owned by another transition (Community/League outlets) or by an
 * immersive full-screen shell is explicitly left alone.
 *
 * Pure + framework-free so every rule is unit-testable in the node env.
 */

import { PRIMARY_TABS, primaryTabIndex, primaryTabPath, slideDirection } from "./primaryTabs";

/**
 * How the shell should treat a given route's content:
 *  • primary          — one of the five tab-level views (lateral slide domain)
 *  • detail           — a non-immersive page one level deeper inside the shell
 *  • league           — /player/leagues/* — LeagueTransitionOutlet owns it
 *  • community-inner  — /player/community/group/* — CommunityTransitionOutlet owns it
 *  • immersive        — chrome-replacing full-screen route (DM chat, match entry)
 *  • other            — not a shell content route
 */
export type ShellRouteKind =
  | "primary"
  | "detail"
  | "league"
  | "community-inner"
  | "immersive"
  | "other";

/** The five tab-level views. /friends and /messages are Social tab views, so
 *  moving between them and /social is within-tab (no push, no lateral slide). */
const PRIMARY_VIEW_PATHS = new Set<string>([
  "/player/dashboard",
  "/player/matches",
  "/player/social",
  "/player/friends",
  "/player/messages",
  "/player/community",
  "/player/profile",
]);

function seg(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Classify a pathname into its shell content bucket. Order matters: the
 *  outlet-owned + immersive subtrees are matched before the primary/detail
 *  fallbacks (e.g. /player/messages/:id is immersive, not the Social view). */
export function shellRouteKind(pathname: string): ShellRouteKind {
  if (seg(pathname, "/player/leagues")) return "league";
  if (seg(pathname, "/player/community/group")) return "community-inner";
  // DM thread (has an id) and the match-entry flow replace the shell chrome.
  if (pathname.startsWith("/player/messages/")) return "immersive";
  if (pathname === "/player/matches/new") return "immersive";
  if (PRIMARY_VIEW_PATHS.has(pathname)) return "primary";
  if (pathname.startsWith("/player/")) return "detail";
  return "other";
}

/** Explicit depth within the pushable region: a tab-level view is 0, a detail
 *  page is 1. Only meaningful for primary/detail routes (the push domain). */
export function shellDepth(pathname: string): number {
  const kind = shellRouteKind(pathname);
  if (kind === "primary") return 0;
  if (kind === "detail") return 1;
  return 0;
}

export type TransitionKind =
  | "primary-tab"
  | "detail-forward"
  | "detail-back"
  | "none";

export type NavigationType = "PUSH" | "POP" | "REPLACE";

export interface NavInput {
  /** Previous pathname, or null on first render / direct deep-link. */
  prevPath: string | null;
  nextPath: string;
  navigationType: NavigationType;
}

export interface NavResult {
  kind: TransitionKind;
  /** +1 enters from the right, -1 enters from the left, 0 no movement. */
  direction: -1 | 0 | 1;
}

const NONE: NavResult = { kind: "none", direction: 0 };

/**
 * Decide the transition for a route change.
 *
 *  • Routes owned by another transition (league / community-inner) or by an
 *    immersive shell never get a shell-level page transition.
 *  • First render (prevPath === null) and REPLACE navigations never fabricate
 *    a direction — deep links, canonical/query rewrites, and auth/permission
 *    redirects render in place.
 *  • Query-only changes (same pathname) do nothing.
 *  • primary ↔ primary slides laterally by tab order (0 within the same tab,
 *    e.g. Social ↔ Friends).
 *  • primary/detail ↔ detail pushes forward when going deeper and back when
 *    returning, using explicit depth (never URL length).
 *  • Coming from an outlet/immersive/other route into a primary/detail route
 *    produces no fabricated animation (the container remounts fresh instead).
 */
export function classifyTransition(input: NavInput): NavResult {
  const { prevPath, nextPath, navigationType } = input;

  const toKind = shellRouteKind(nextPath);
  if (
    toKind === "league" ||
    toKind === "community-inner" ||
    toKind === "immersive" ||
    toKind === "other"
  ) {
    return NONE;
  }

  if (prevPath === null) return NONE; // first render / deep-link
  if (navigationType === "REPLACE") return NONE; // canonical/auth/permission rewrites
  if (prevPath === nextPath) return NONE; // query-string-only change

  const fromKind = shellRouteKind(prevPath);

  if (fromKind === "primary" && toKind === "primary") {
    const d = slideDirection(primaryTabIndex(prevPath), primaryTabIndex(nextPath));
    return d === 0 ? NONE : { kind: "primary-tab", direction: d };
  }

  if (
    (fromKind === "primary" || fromKind === "detail") &&
    (toKind === "primary" || toKind === "detail")
  ) {
    const delta = shellDepth(nextPath) - shellDepth(prevPath);
    if (delta > 0) return { kind: "detail-forward", direction: 1 };
    if (delta < 0) return { kind: "detail-back", direction: -1 };
    return NONE; // same depth (e.g. sibling detail) → no fabricated push
  }

  // From league / community-inner / immersive / other → no fabricated motion.
  return NONE;
}

/** Animation key for the shell content layer: primary tabs share their root
 *  key (so within-tab query/sub-view changes don't re-animate); everything
 *  else keys by pathname. */
export function transitionKey(pathname: string): string {
  const kind = shellRouteKind(pathname);
  if (kind === "primary") return primaryTabPath(pathname) ?? pathname;
  if (kind === "league") return "league-subtree";
  if (kind === "community-inner") return "community-subtree";
  return pathname;
}

/** Restrained, known-page labels for the screen-reader route announcer.
 *  Only these + the primary tabs are announced — we never announce unknown
 *  routes, loading states, or query-only changes. */
const DETAIL_LABELS: Record<string, string> = {
  "/player/pulse": "Pulse",
  "/player/round-robins": "My round robins",
  "/player/guests": "My guests",
  "/player/events": "Events",
  "/player/my-events": "My events",
  "/player/play": "Play",
  "/player/profile/edit": "Edit profile",
  "/player/self-assessment": "Skill assessment",
};

export function routeAnnouncement(pathname: string): string | null {
  const kind = shellRouteKind(pathname);
  if (kind === "primary") {
    const i = primaryTabIndex(pathname);
    return i >= 0 ? PRIMARY_TABS[i].label : null;
  }
  return DETAIL_LABELS[pathname] ?? null;
}
