import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared premium presentation primitives for the player-facing social surfaces.
 * The hero is also used by sibling tabs so mobile page identity stays uniform.
 */

/** Restrained mobile-first title band used across the primary player tabs. */
export function SocialHero({
  eyebrow,
  title,
  action,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border/50 bg-card/35",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full blur-3xl opacity-[0.10]"
        style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 68%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-primary/35"
      />
      <div className="relative container mx-auto max-w-3xl px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="relative min-w-0 pl-3.5">
            <span
              aria-hidden
              className="absolute bottom-1 left-0 top-1 w-[3px] rounded-full bg-primary"
            />
            <div className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">
              {eyebrow}
            </div>
            <h1 className="text-[23px] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground sm:text-[27px]">
              {title}
            </h1>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** Scoreboard-style stat tile (label above a tabular value). */
export function SocialStatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card/80 px-2.5 py-2 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)]">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className={cn("h-3 w-3", accent ? "text-primary" : "text-primary/80")} />
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-[15px] font-bold tabular-nums tracking-tight",
          accent && value !== "0" ? "text-primary" : "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Glassy container for grouped rows (people, conversations). */
export function GlassPanel({
  children,
  className,
  divided = true,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  divided?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border/60 bg-card/80 shadow-[0_8px_30px_-22px_hsl(var(--foreground)/0.35)]",
        divided && "divide-y divide-border/50",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

/** Standalone glass row — used where rows sit in a grid instead of a panel. */
export const glassRow =
  "flex min-h-[68px] items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 " +
  "shadow-[0_2px_14px_-10px_hsl(var(--foreground)/0.35)] transition-[transform,background-color,border-color] hover:border-primary/20 hover:bg-card active:scale-[0.99] motion-reduce:transform-none";

/** Premium empty state with an accent tile and optional CTA. */
export function SocialEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="relative mb-4">
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl"
        />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <h3 className="mb-1 text-base font-bold tracking-tight text-foreground">{title}</h3>
      <p className="max-w-[280px] text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
