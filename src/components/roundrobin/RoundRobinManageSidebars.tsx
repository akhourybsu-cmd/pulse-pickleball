import {
  UserPlus, Zap, Pencil, CheckCircle2, Circle, Users, Star,
  ClipboardList, CalendarClock, MapPin, CalendarDays, Trophy,
  ListChecks,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Desktop-only sidebar cards for the Round Robin management console.
 *
 * These are PRESENTATIONAL — every piece of data and every callback is
 * passed in from RoundRobinDetail, which owns all state + business
 * logic. Nothing here fetches, mutates, or derives event state beyond
 * trivial display math (e.g. "0 of 3 steps").
 *
 * Rendered only at lg+ (the parent wraps them in `hidden lg:flex`), so
 * the mobile layout is completely untouched — mobile keeps the existing
 * single-column WhatsNextBanner + Tabs flow.
 */

const MIN_PLAYERS = 4;

export interface RRSidebarProps {
  playerCount: number;
  hasSchedule: boolean;
  status: string;
  format: string | null;
  date: string | null;
  startTime: string | null;
  location: string | null;
  ratingEligible: boolean;
  allowGuests: boolean;
  onAddPlayers: () => void;
  onGenerateSchedule: () => void;
  onEditEvent: () => void;
  onGoToPlayers: () => void;
}

/** Derive the three-step setup progress from real event state. */
function setupSteps(playerCount: number, hasSchedule: boolean, status: string) {
  const hasEnoughPlayers = playerCount >= MIN_PLAYERS;
  const published = status !== "draft";
  return [
    {
      key: "players",
      label: "Add players",
      hint: `Add at least ${MIN_PLAYERS} players to continue.`,
      done: hasEnoughPlayers,
    },
    {
      key: "schedule",
      label: "Generate schedule",
      hint: "Create games using round robin.",
      done: hasSchedule,
    },
    {
      key: "publish",
      label: "Review & publish",
      hint: "Review matches and publish.",
      done: published && hasSchedule,
    },
  ];
}

/* ============================ LEFT ============================ */

export function RRLeftSidebar(props: RRSidebarProps) {
  const steps = setupSteps(props.playerCount, props.hasSchedule, props.status);
  const completed = steps.filter((s) => s.done).length;

  return (
    <div className="space-y-4">
      {/* Setup progress */}
      <SidebarCard icon={ListChecks} title="Setup progress">
        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
          Complete the steps below to generate your schedule.
        </p>
        <ol className="space-y-2.5">
          {steps.map((s) => (
            <li key={s.key} className="flex items-start gap-2.5">
              {s.done ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <div className={cn(
                  "text-sm font-semibold leading-tight",
                  s.done ? "text-foreground" : "text-foreground/90",
                )}>
                  {s.label}
                </div>
                <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {s.hint}
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
            <span className="font-semibold">{completed} of {steps.length} steps completed</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </SidebarCard>

      {/* Quick actions */}
      <SidebarCard icon={Zap} title="Quick actions">
        <div className="space-y-2">
          <button
            type="button"
            onClick={props.onAddPlayers}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)]"
          >
            <UserPlus className="w-4 h-4" />
            Add Players
          </button>
          <button
            type="button"
            onClick={props.onEditEvent}
            className="w-full h-10 rounded-lg border border-border bg-card text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted/50 active:scale-[0.98] transition-all"
          >
            <Pencil className="w-4 h-4" />
            Edit Event
          </button>
          <button
            type="button"
            onClick={props.onGenerateSchedule}
            disabled={props.playerCount < MIN_PLAYERS}
            className="w-full h-10 rounded-lg border border-border bg-card text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted/50 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            <Zap className="w-4 h-4" />
            Generate Schedule
          </button>
        </div>
      </SidebarCard>

      {/* Status / info */}
      <SidebarCard>
        <div className="space-y-3">
          {props.allowGuests && (
            <StatusRow
              icon={Users}
              title="Guests are enabled"
              desc="Guests can register for this event."
            />
          )}
          {!props.ratingEligible && (
            <StatusRow
              icon={Star}
              title="PULSE Ratings are disabled"
              desc="This event will not affect player ratings."
            />
          )}
        </div>
      </SidebarCard>
    </div>
  );
}

/* ============================ RIGHT ============================ */

export function RRRightSidebar(props: RRSidebarProps) {
  const remainingToMin = Math.max(0, MIN_PLAYERS - props.playerCount);

  return (
    <div className="space-y-4">
      {/* Roster summary */}
      <SidebarCard icon={Users} title="Roster summary">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-3xl font-black tabular-nums leading-none">
              {props.playerCount}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Players added
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Minimum required</span>
          <span className="font-semibold tabular-nums">{MIN_PLAYERS} players</span>
        </div>
        <button
          type="button"
          onClick={props.onGoToPlayers}
          className="w-full mt-3 h-10 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted/50 active:scale-[0.98] transition-all"
        >
          Manage Players
        </button>
      </SidebarCard>

      {/* Next steps */}
      <SidebarCard icon={ClipboardList} title="Next steps">
        <ol className="space-y-3">
          <NextStep
            icon={UserPlus}
            title={remainingToMin > 0
              ? `Add ${remainingToMin} more player${remainingToMin === 1 ? "" : "s"}`
              : "Players ready"}
            desc="Invite or add players to your event."
            done={props.playerCount >= MIN_PLAYERS}
          />
          <NextStep
            icon={Zap}
            title="Generate schedule"
            desc="Create the round robin matchups."
            done={props.hasSchedule}
          />
          <NextStep
            icon={Trophy}
            title="Review & publish"
            desc="Review matches and publish when ready."
            done={props.status !== "draft" && props.hasSchedule}
          />
        </ol>
      </SidebarCard>

      {/* Event details */}
      <SidebarCard icon={ClipboardList} title="Event details">
        <dl className="space-y-2.5 text-sm">
          {props.location && (
            <DetailRow icon={MapPin} value={props.location} />
          )}
          {props.startTime && (
            <DetailRow icon={CalendarClock} value={props.startTime} />
          )}
          {props.date && (
            <DetailRow icon={CalendarDays} value={props.date} />
          )}
          {props.format && (
            <DetailRow icon={Trophy} value={`Format: ${props.format}`} />
          )}
        </dl>
      </SidebarCard>
    </div>
  );
}

/* ============================ primitives ============================ */

function SidebarCard({
  icon: Icon, title, children,
}: {
  icon?: typeof Users;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      {title && (
        <div className="flex items-center gap-1.5 mb-3">
          {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
          <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h3>
        </div>
      )}
      {children}
    </div>
  );
}

function StatusRow({
  icon: Icon, title, desc,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {desc}
        </div>
      </div>
    </div>
  );
}

function NextStep({
  icon: Icon, title, desc, done,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  done: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <div className={cn(
        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
        done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
      )}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">
          {desc}
        </div>
      </div>
    </li>
  );
}

function DetailRow({ icon: Icon, value }: { icon: typeof Users; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span className="text-foreground/90 truncate">{value}</span>
    </div>
  );
}
