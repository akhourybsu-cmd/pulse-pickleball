import {
  Trophy, CalendarDays, Layers, Users, UsersRound,
  CalendarClock, Swords, Award, Shield, LifeBuoy, ClipboardList,
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
  | "actions" | "overview" | "seasons"
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
  group: "To review" | "Players & subs" | "Competition" | "League setup";
  /** One-line hint shown under the label on the desktop rail. */
  hint: string;
}

export const MANAGE_TABS: TabDef[] = [
  { key: "actions", label: "Actions", short: "Actions", icon: ClipboardList, group: "To review", hint: "Requests, approvals and results to review" },
  { key: "members",   label: "Players",    short: "Players",  icon: Users,         group: "Players & subs",  hint: "Everyone in this league" },
  { key: "teams",     label: "Teams",      short: "Teams",    icon: UsersRound,    group: "Players & subs",  hint: "Fixed pairs or rosters" },
  { key: "subs",      label: "Substitutes", short: "Subs",     icon: LifeBuoy,      group: "Players & subs",  hint: "Available subs and weekly replacements" },
  { key: "ladder",    label: "Ladder & weeks", short: "Ladder", icon: Layers,       group: "Competition",    hint: "Schedule batches and manage each week" },
  { key: "sessions",  label: "Sessions",   short: "Sessions", icon: CalendarClock, group: "Competition",    hint: "Nights of scheduled play" },
  { key: "matches",   label: "Matches",    short: "Matches",  icon: Swords,        group: "Competition",    hint: "Individual matchups" },
  { key: "standings", label: "Standings",  short: "Table",    icon: Award,         group: "Competition", hint: "Wins, points, form" },
  { key: "overview",  label: "League settings", short: "Settings", icon: Trophy,     group: "League setup",   hint: "Details, visibility and invitations" },
  { key: "seasons",   label: "Seasons",    short: "Seasons",  icon: CalendarDays,  group: "League setup",   hint: "Dates, registration and season status" },
  { key: "audit",     label: "Activity log", short: "Activity", icon: Shield,       group: "League setup",     hint: "Changes, who made them and when" },
];

export const GROUPS = ["To review", "Players & subs", "Competition", "League setup"] as const;

/**
 * The tabs that make sense for a given league type. The product runs two
 * setups: an automated ladder and a manual "basic" league. We only surface
 * the Play tabs each one actually uses:
 *   • ladder leagues drive scheduling from the Ladder tab's own week planner,
 *     so the manual "Sessions" tab is hidden, and they have no fixed teams,
 *     so "Teams" is hidden;
 *   • non-ladder ("basic"/doubles) leagues have no ladder engine, so the
 *     "Ladder" tab (which would only show a dead-end) is hidden, and they get
 *     the "Teams" tab for fixed pairs/rosters.
 * Everything else (Overview, Seasons, Players, Subs, Matches, Standings,
 * Audit) is shared. Order is preserved from MANAGE_TABS.
 */
export function visibleManageTabs(leagueType: string): TabDef[] {
  const isLadder = leagueType === "ladder";
  return MANAGE_TABS.filter((t) => {
    if (t.key === "sessions") return !isLadder;
    if (t.key === "teams") return leagueType === 'doubles' || leagueType === 'team';
    if (t.key === "ladder") return isLadder;
    return true;
  });
}
