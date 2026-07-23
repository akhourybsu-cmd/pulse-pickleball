import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trophy, CalendarDays, Layers, Users,
  CalendarClock, Swords, Award, Shield, LifeBuoy,
  Check, ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * The full set of manage tabs, in canonical display order. Callers
 * consume this array to render both the nav (desktop rail + mobile
 * strip) and to dispatch which tab body to render.
 */
export type ManageTab =
  | "overview" | "seasons" | "divisions"
  | "members" | "teams" | "subs"
  | "ladder" | "sessions" | "matches"
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
  { key: "members",   label: "Players",    short: "Players",  icon: Users,         group: "People",  hint: "Everyone in this league" },
  { key: "subs",      label: "Subs",       short: "Subs",     icon: LifeBuoy,      group: "People",  hint: "Sub pool + swap into a week" },
  { key: "ladder",    label: "Ladder",     short: "Ladder",   icon: Layers,        group: "Play",    hint: "Individual doubles ladder" },
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
        <div className="rounded-xl border border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] p-2 space-y-3 shadow-[inset_0_1px_0_0_rgba(201,168,76,0.08)]">
          {GROUPS.map((group) => {
            const items = MANAGE_TABS.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="space-y-0.5">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--lg-gold)]/70 px-2 py-1">
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
                        "relative w-full text-left rounded-md pl-3 pr-2.5 py-2 flex items-center gap-2.5 transition-colors group",
                        isActive
                          ? "text-[color:var(--lg-text)]"
                          : "text-[color:var(--lg-text-dim)] hover:bg-white/5 hover:text-[color:var(--lg-text)]",
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-active"
                          className="absolute inset-0 rounded-md bg-[color:var(--lg-emerald)]/25 ring-1 ring-[color:var(--lg-emerald)]/40"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="league-nav-bar"
                          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[color:var(--lg-gold)]"
                          transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          aria-hidden
                        />
                      )}
                      <Icon className={cn(
                        "w-4 h-4 shrink-0 relative",
                        isActive ? "text-[color:var(--lg-gold)]" : "text-[color:var(--lg-text-dim)] group-hover:text-[color:var(--lg-text)]",
                      )} />
                      <div className="min-w-0 relative">
                        <div className="text-[13px] font-semibold leading-tight tracking-normal">
                          {t.label}
                        </div>
                        <div className={cn(
                          "text-[11px] leading-tight truncate font-normal",
                          isActive ? "text-[color:var(--lg-text)]/70" : "text-[color:var(--lg-text-dim)]/80",
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

      {/* ------------------ Mobile section picker ------------------ */}
      <MobileSectionPicker active={active} onChange={onChange} />
    </>
  );
}

function MobileSectionPicker({
  active, onChange,
}: {
  active: ManageTab;
  onChange: (t: ManageTab) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeDef = MANAGE_TABS.find((t) => t.key === active) ?? MANAGE_TABS[0];
  const ActiveIcon = activeDef.icon;

  return (
    <div className="lg:hidden">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left active:scale-[0.99] transition-transform"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <ActiveIcon className="w-[18px] h-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                Section
              </div>
              <div className="text-sm font-bold truncate leading-tight">
                {activeDef.label}
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader className="text-left pb-2">
            <DrawerTitle>Jump to section</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8 space-y-4 max-h-[65vh] overflow-y-auto">
            {GROUPS.map((group) => {
              const items = MANAGE_TABS.filter((t) => t.group === group);
              if (items.length === 0) return null;
              return (
                <div key={group} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-1">
                    {group}
                  </div>
                  {items.map((t) => {
                    const Icon = t.icon;
                    const isActive = active === t.key;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => { onChange(t.key); setOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                            : "hover:bg-muted/60 active:bg-muted",
                        )}
                      >
                        <Icon className={cn(
                          "w-4 h-4 shrink-0",
                          isActive ? "text-primary" : "text-muted-foreground",
                        )} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold leading-tight">{t.label}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{t.hint}</div>
                        </div>
                        {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
