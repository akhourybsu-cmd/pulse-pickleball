import { motion } from "framer-motion";
import {
  Trophy, CalendarDays, Layers, Users, UsersRound,
  CalendarClock, Swords, Award, Shield,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The full set of manage tabs, in canonical display order. Callers
 * consume this array to render both the nav (desktop rail + mobile
 * strip) and to dispatch which tab body to render.
 */
export type ManageTab =
  | "overview" | "seasons" | "divisions"
  | "members" | "teams"
  | "sessions" | "matches"
  | "standings"
  | "audit";

interface TabDef {
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
  { key: "divisions", label: "Divisions",  short: "Divs",     icon: Layers,        group: "Setup",   hint: "Skill tiers within a season" },
  { key: "members",   label: "Members",    short: "Members",  icon: Users,         group: "People",  hint: "Active players in this league" },
  { key: "teams",     label: "Teams",      short: "Teams",    icon: UsersRound,    group: "People",  hint: "Rosters + captains" },
  { key: "sessions",  label: "Sessions",   short: "Sessions", icon: CalendarClock, group: "Play",    hint: "Nights of scheduled play" },
  { key: "matches",   label: "Matches",    short: "Matches",  icon: Swords,        group: "Play",    hint: "Individual matchups" },
  { key: "standings", label: "Standings",  short: "Table",    icon: Award,         group: "Results", hint: "Wins, points, form" },
  { key: "audit",     label: "Audit log",  short: "Log",      icon: Shield,        group: "Log",     hint: "Every change, who + when" },
];

const GROUPS = ["Setup", "People", "Play", "Results", "Log"] as const;

/**
 * Grouped nav for the league management surface.
 *
 *   Desktop (lg+): vertical rail on the left, ~200px wide. Groups are
 *   uppercase eyebrows; active tab gets a primary-tinted background +
 *   left accent bar. Framer Motion `layoutId` slides the accent
 *   between tabs smoothly.
 *
 *   Mobile: horizontal scrollable strip. Uses shorter labels + icon.
 *   Active tab gets a filled pill. Scroll-snaps for a native feel.
 */
export function LeagueManageNav({
  active, onChange,
}: {
  active: ManageTab;
  onChange: (t: ManageTab) => void;
}) {
  return (
    <>
      {/* ------------------ Desktop rail ------------------ */}
      <aside className="hidden lg:block w-[220px] shrink-0 sticky top-4 self-start">
        <div className="rounded-2xl border border-border/60 bg-card p-2 space-y-3">
          {GROUPS.map((group) => {
            const items = MANAGE_TABS.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-2 py-1">
                  {group}
                </div>
                {items.map((t) => {
                  const Icon = t.icon;
                  const isActive = active === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => onChange(t.key)}
                      className={cn(
                        "relative w-full text-left rounded-lg px-2.5 py-2 flex items-center gap-2.5 transition-colors group",
                        isActive
                          ? "text-primary"
                          : "text-foreground/80 hover:bg-muted/50 hover:text-foreground",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-active"
                          className="absolute inset-0 rounded-lg bg-primary/10 ring-1 ring-primary/25"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-primary"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      <Icon className={cn(
                        "w-4 h-4 shrink-0 relative",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )} />
                      <div className="min-w-0 relative">
                        <div className="text-sm font-semibold leading-tight">
                          {t.label}
                        </div>
                        <div className={cn(
                          "text-[10px] leading-tight truncate",
                          isActive ? "text-primary/70" : "text-muted-foreground",
                        )}>
                          {t.hint}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {/* ------------------ Mobile strip ------------------ */}
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto scroll-smooth snap-x">
        <div className="inline-flex gap-1.5 min-w-full pb-2">
          {MANAGE_TABS.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => onChange(t.key)}
                className={cn(
                  "relative snap-start shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors",
                  isActive
                    ? "text-primary-foreground"
                    : "bg-muted/60 text-foreground/70 hover:bg-muted",
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="league-nav-pill"
                    className="absolute inset-0 rounded-full bg-primary shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.5)]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    aria-hidden
                  />
                )}
                <Icon className="w-3.5 h-3.5 relative" />
                <span className="relative">{t.short}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
