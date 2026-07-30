import {
  Trophy, CalendarDays, Layers, Users,
  CalendarClock, Swords, Award, Shield, LifeBuoy,
  type LucideIcon,
} from "lucide-react";

/**
 * The full set of manage tabs, in canonical display order. Callers
 * consume this array to render both the nav (desktop rail + mobile
 * strip) and to dispatch which tab body to render.
 *
 * Lives in its own module (not the nav component file) so the nav can
 * export only React components — keeps Fast Refresh happy.
 */
export type ManageTab =
  | "overview" | "seasons"
  | "members" | "teams" | "subs"
  | "ladder" | "sessions" | "matches"
  | "standings"
  | "audit";

export interface TabDef {
  key: ManageTab;
  label: string;
  /** Short label used when the mobile strip is tight. */
  short: string;
  icon: LucideIcon;
  group: "Setup" | "People" | "Play" | "Results" | "Log";
  /** One-line hint shown under the label on the desktop rail. */
  hint: string;
}

export const MANAGE_TABS: TabDef[] = [
  { key: "overview",  label: "Overview",   short: "Info",     icon: Trophy,        group: "Setup",   hint: "Details, visibility, invite code" },
  { key: "seasons",   label: "Seasons",    short: "Seasons",  icon: CalendarDays,  group: "Setup",   hint: "Semesters or session runs" },
  { key: "members",   label: "Players",    short: "Players",  icon: Users,         group: "People",  hint: "Everyone in this league" },
  { key: "subs",      label: "Subs",       short: "Subs",     icon: LifeBuoy,      group: "People",  hint: "Sub pool + swap into a week" },
  { key: "ladder",    label: "Ladder",     short: "Ladder",   icon: Layers,        group: "Play",    hint: "Individual doubles ladder" },
  { key: "sessions",  label: "Sessions",   short: "Sessions", icon: CalendarClock, group: "Play",    hint: "Nights of scheduled play" },
  { key: "matches",   label: "Matches",    short: "Matches",  icon: Swords,        group: "Play",    hint: "Individual matchups" },
  { key: "standings", label: "Standings",  short: "Table",    icon: Award,         group: "Results", hint: "Wins, points, form" },
  { key: "audit",     label: "Audit log",  short: "Log",      icon: Shield,        group: "Log",     hint: "Every change, who + when" },
];

export const GROUPS = ["Setup", "People", "Play", "Results", "Log"] as const;

/**
 * The tabs that make sense for a given league type. The product runs two
 * setups: an automated ladder and a manual "basic" league. We only surface
 * the Play tabs each one actually uses:
 *   • ladder leagues drive scheduling from the Ladder tab's own week planner,
 *     so the manual "Sessions" tab is hidden;
 *   • non-ladder leagues have no ladder engine, so the "Ladder" tab (which
 *     would only show a dead-end) is hidden.
 * Everything else (Overview, Seasons, Players, Subs, Matches, Standings,
 * Audit) is shared. Order is preserved from MANAGE_TABS.
 */
export function visibleManageTabs(leagueType: string): TabDef[] {
  const isLadder = leagueType === "ladder";
  return MANAGE_TABS.filter((t) => {
    if (t.key === "sessions") return !isLadder;
    if (t.key === "ladder") return isLadder;
    return true;
  });
}
