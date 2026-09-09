import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { League, LeagueType } from "@/lib/leagues/types";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { MapPin, UserCircle2 } from "lucide-react";

/**
 * Shared design surface for every league-facing page. Adding a page to
 * the league experience? Wrap it in <LeagueScope> and it inherits the
 * PULSE cream/ink/gold tokens + Manrope/Sora type + correct light/dark
 * variant with no per-page work.
 */
export function LeagueScope({
  children,
  /** If true, force dark-mode tokens regardless of app theme.
   *  Organizer console can opt in when a dark workspace reads better. */
  forceDark = false,
  className,
}: {
  children: ReactNode;
  forceDark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "league-scope",
        forceDark && "dark",
        "bg-[color:var(--lg-bg)] min-h-screen",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The one hero component used by both the player league detail page and
 * the organizer console. Anatomy:
 *
 *   [type chip] [status] [flags]                 (optional right-slot)
 *   League name (PULSE display type, original capitalization)
 *   optional description
 *   MapPin location · Manager name
 *   ─ gold hairline ─
 *   [KPI 1] [KPI 2] [KPI 3] [KPI 4]              scoreboard strip
 */
export function LeagueHero({
  league,
  managerName,
  kpis,
  rightSlot,
  eyebrow,
}: {
  league: Pick<
    League,
    "name" | "description" | "location" | "league_type" | "status" | "visibility" | "rating_eligible" | "guests_allowed"
  >;
  managerName?: string | null;
  kpis?: Array<{ icon: LucideIcon; label: string; value: number | string }>;
  rightSlot?: ReactNode;
  eyebrow?: ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative min-w-0 overflow-hidden rounded-2xl border border-[color:var(--lg-border)] lg-hero-gradient"
    >
      {/* Diagonal court-line texture */}
      <div className="absolute inset-0 lg-court-lines pointer-events-none" aria-hidden />
      {/* Gold hairline top edge */}
      <div className="absolute top-0 left-0 right-0 h-px lg-hairline" aria-hidden />

      <div className="relative p-5 sm:p-6">
        {/* Meta row */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <LeagueTypeChip type={league.league_type} onHero />
            <LeagueStatusPill status={league.status} onHero />
            {league.rating_eligible && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-[color:var(--lg-hero-gold)] ring-1 ring-[color:var(--lg-hero-chip-ring)]">
                Rating-eligible
              </span>
            )}
            {eyebrow}
          </div>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>

        {/* Title */}
        <h1 className="font-display mt-4 break-words text-2xl sm:text-3xl lg:text-4xl leading-tight text-[color:var(--lg-hero-text)]">
          {league.name}
        </h1>

        {league.description && (
          <p className="text-[color:var(--lg-hero-text-dim)] text-sm mt-2 max-w-2xl break-words leading-relaxed">
            {league.description}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--lg-hero-text-dim)]">
          {league.location && (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="min-w-0 break-words">{league.location}</span>
            </span>
          )}
          {managerName && (
            <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5 shrink-0 text-[color:var(--lg-hero-gold)]" />
              <span className="text-xs font-semibold text-[color:var(--lg-hero-gold)]">
                Manager
              </span>
              <span className="min-w-0 break-words text-[color:var(--lg-hero-text)] font-medium">{managerName}</span>
            </span>
          )}
        </div>

        {/* KPI scoreboard */}
        {kpis && kpis.length > 0 && (
          <div
            className={cn(
              "mt-5 grid gap-x-4 gap-y-1 border-t border-white/15",
              kpis.length === 3
                ? typeof kpis[0].value === 'string' && !/^[\d–.%+-]+$/.test(kpis[0].value)
                  ? "grid-cols-2 sm:grid-cols-3 [&>div:first-child]:col-span-2 sm:[&>div:first-child]:col-span-1"
                  : "grid-cols-3"
                : "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {kpis.map((k) => (
              <HeroStat key={k.label} icon={<k.icon className="w-3.5 h-3.5" />} label={k.label} value={k.value} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/**
 * Clear tabular stat with a readable sentence-case label.
 * Uses hero-* tokens because it always sits on the dark hero gradient.
 */
export function HeroStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-0 flex flex-col items-start py-3">
      <div className="flex items-center gap-1.5 text-[color:var(--lg-hero-gold)]">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={cn("mt-2 break-words text-[color:var(--lg-hero-text)]", typeof value === 'number' || /^[\d–.%+-]+$/.test(String(value)) ? "lg-num text-2xl sm:text-3xl leading-tight" : "text-sm sm:text-base font-semibold leading-snug")}>
        {value}
      </div>
    </div>
  );
}

/** Type chip — emerald+gold branded, consistent across surfaces.
 *  Pass onHero to render against the dark hero gradient (constant tokens). */
export function LeagueTypeChip({ type, onHero = false }: { type: LeagueType; onHero?: boolean }) {
  const meta = LEAGUE_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ring-1",
        onHero
          ? "bg-[color:var(--lg-hero-chip-bg)] text-[color:var(--lg-hero-gold)] ring-[color:var(--lg-hero-chip-ring)]"
          : "bg-[color:var(--lg-eyebrow-bg)] text-[color:var(--lg-accent-gold)] ring-[color:var(--lg-eyebrow-ring)]",
      )}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

/** Status pill — active/draft/archived. */
export function LeagueStatusPill({ status, onHero = false }: { status: League["status"]; onHero?: boolean }) {
  const activeTone = onHero
    ? "bg-[color:var(--lg-emerald-bright)]/25 text-[color:var(--lg-hero-text)] ring-1 ring-[color:var(--lg-emerald-bright)]/60"
    : "bg-[color:var(--lg-emerald)]/20 text-[color:var(--lg-emerald)] ring-1 ring-[color:var(--lg-emerald)]/40";
  const mutedTone = onHero
    ? "bg-white/10 text-[color:var(--lg-hero-text-dim)] ring-1 ring-white/20"
    : "bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text-dim)] ring-1 ring-[color:var(--lg-border)]";
  const tone = status === "active" ? activeTone : mutedTone;
  return (
    <span
      className={cn(
        "text-xs font-semibold capitalize px-2.5 py-1 rounded-md",
        tone,
      )}
    >
      {status}
    </span>
  );
}

/**
 * Quiet section header with an icon well and a hairline underline. Replaces
 * the ad-hoc `text-xs font-bold uppercase text-muted-foreground` blocks
 * on player pages so section rhythm matches the organizer console.
 */
export function LgSectionHeader({
  icon: Icon,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex min-w-0 items-center gap-2 text-base font-semibold leading-snug text-[color:var(--lg-text)]">
          {Icon && <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--lg-eyebrow-bg)] text-[color:var(--lg-accent-gold)]"><Icon className="h-4 w-4" aria-hidden /></span>}
          {children}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-1.5 h-px lg-hairline" aria-hidden />
    </div>
  );
}

/** Stable page footprint while league data loads; no fake interactive controls. */
export function LeaguePageSkeleton({ manager = false }: { manager?: boolean }) {
  return <LeagueScope>
    <div role="status" aria-label={manager ? 'Loading league management' : 'Loading league'} className={cn('mx-auto space-y-5 px-4 py-5 sm:px-6', manager ? 'max-w-[1440px] lg:px-8' : 'max-w-5xl')}>
      <span className="sr-only">Loading your league…</span>
      <div aria-hidden className="space-y-5 motion-safe:animate-pulse">
        <div className="h-11 w-28 rounded-xl bg-muted" />
        <div className="lg-card space-y-4 p-6"><div className="h-5 w-28 rounded bg-muted" /><div className="h-8 w-3/4 rounded bg-muted" /><div className="h-4 w-1/2 rounded bg-muted" /><div className="h-16 rounded-xl bg-muted/60" /></div>
        <div className={cn('grid gap-5', manager && 'lg:grid-cols-[248px_minmax(0,1fr)]')}>
          {manager && <div className="hidden h-96 rounded-2xl bg-muted/60 lg:block" />}
          <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="lg-card h-24" />)}</div>
        </div>
      </div>
    </div>
  </LeagueScope>;
}

