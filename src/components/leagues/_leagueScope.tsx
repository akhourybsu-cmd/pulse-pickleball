import { ReactNode } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { League, LeagueType } from "@/lib/leagues/types";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { MapPin, UserCircle2 } from "lucide-react";

/**
 * Shared design surface for every league-facing page. Adding a page to
 * the league experience? Wrap it in <LeagueScope> and it inherits the
 * Emerald Prestige tokens + Bebas display type + correct light/dark
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
  const { resolvedTheme } = useTheme();
  const light = !forceDark && resolvedTheme === "light";
  return (
    <div
      className={cn(
        "league-scope",
        light && "league-scope--light",
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
 *   LEAGUE NAME (Bebas display)
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
  const typeMeta = LEAGUE_TYPE_META[league.league_type];
  const TypeIcon = typeMeta.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border border-[color:var(--lg-border)] lg-hero-gradient shadow-[inset_0_1px_0_0_var(--lg-inset)]"
    >
      {/* Diagonal court-line texture */}
      <div className="absolute inset-0 lg-court-lines pointer-events-none" aria-hidden />
      {/* Gold hairline top edge */}
      <div className="absolute top-0 left-0 right-0 h-px lg-hairline" aria-hidden />

      <div className="relative p-5 sm:p-6">
        {/* Meta row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <LeagueTypeChip type={league.league_type} />
            <LeagueStatusPill status={league.status} />
            {league.rating_eligible && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--lg-gold-bright)] ring-1 ring-[color:var(--lg-gold)]/50">
                Rating-eligible
              </span>
            )}
            {eyebrow}
          </div>
          {rightSlot && <div className="shrink-0">{rightSlot}</div>}
        </div>

        {/* Title */}
        <h1 className="font-display mt-3 text-3xl sm:text-4xl leading-[1] text-[color:var(--lg-text)]">
          {league.name.toUpperCase()}
        </h1>

        {league.description && (
          <p className="text-[color:var(--lg-text-dim)] text-sm mt-2 max-w-2xl leading-relaxed">
            {league.description}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--lg-text-dim)]">
          {league.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {league.location}
            </span>
          )}
          {managerName && (
            <span className="inline-flex items-center gap-1.5">
              <UserCircle2 className="w-3.5 h-3.5 text-[color:var(--lg-gold)]" />
              <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[color:var(--lg-gold-bright)]">
                Manager
              </span>
              <span className="text-[color:var(--lg-text)]/90 font-medium">{managerName}</span>
            </span>
          )}
        </div>

        {/* KPI scoreboard */}
        {kpis && kpis.length > 0 && (
          <div
            className={cn(
              "mt-5 grid gap-0 border-t border-[color:var(--lg-hairline)] divide-y sm:divide-y-0 sm:divide-x divide-[color:var(--lg-hairline)]",
              kpis.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
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
 * Scoreboard-style hero stat. Bebas numeral over uppercase gold label.
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
    <div className="flex flex-col items-start px-4 py-3 first:pl-0">
      <div className="flex items-center gap-1.5 text-[color:var(--lg-gold-bright)]">
        {icon}
        <span className="text-[10px] uppercase tracking-[0.16em] font-bold">{label}</span>
      </div>
      <div className="lg-num text-3xl sm:text-4xl mt-1 leading-none text-[color:var(--lg-text)]">
        {value}
      </div>
    </div>
  );
}

/** Type chip — emerald+gold branded, consistent across surfaces. */
export function LeagueTypeChip({ type }: { type: LeagueType }) {
  const meta = LEAGUE_TYPE_META[type];
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-[color:var(--lg-eyebrow-bg)] text-[color:var(--lg-eyebrow)] ring-1 ring-[color:var(--lg-eyebrow-ring)]">
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

/** Status pill — active/draft/archived. */
export function LeagueStatusPill({ status }: { status: League["status"] }) {
  const tone =
    status === "active"
      ? "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)] ring-1 ring-[color:var(--lg-emerald)]/50"
      : status === "archived"
        ? "bg-black/10 text-[color:var(--lg-text-dim)] ring-1 ring-[color:var(--lg-border)]"
        : "bg-black/10 text-[color:var(--lg-text-dim)] ring-1 ring-[color:var(--lg-border)]";
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.14em] px-2 py-1 rounded",
        tone,
      )}
    >
      {status}
    </span>
  );
}

/**
 * Uppercase gold section header with a hairline underline. Replaces
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[color:var(--lg-gold-bright)]">
          {Icon && <Icon className="w-3.5 h-3.5" />}
          {children}
        </h2>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-1.5 h-px lg-hairline" aria-hidden />
    </div>
  );
}
