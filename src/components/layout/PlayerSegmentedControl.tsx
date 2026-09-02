import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PlayerSegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  count?: number;
  accentCount?: boolean;
}

/**
 * Shared mobile-first segmented control for top-level views inside a player tab.
 * It keeps switching behavior, touch targets, counts, and active motion
 * consistent across Matches, Social, and Community.
 */
export function PlayerSegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  ariaLabel,
  layoutId,
  className,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly PlayerSegmentOption<T>[];
  ariaLabel: string;
  layoutId: string;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid min-h-11 w-full rounded-2xl border border-border/60 bg-muted/45 p-1 shadow-[inset_0_1px_0_hsl(var(--background)/0.7)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "relative inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-[transform,color] sm:text-sm",
              "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background motion-reduce:transform-none",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                aria-hidden
                className="absolute inset-0 rounded-xl bg-card shadow-[0_4px_14px_-10px_hsl(var(--foreground)/0.55)] ring-1 ring-border/60"
                transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
              />
            )}
            {Icon && <Icon className="relative h-4 w-4 shrink-0" />}
            <span className="relative truncate">{option.label}</span>
            {option.count != null && option.count > 0 && (
              <span
                className={cn(
                  "relative inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                  active
                    ? "bg-primary/15 text-primary"
                    : option.accentCount
                      ? "bg-primary/12 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {option.count > 99 ? "99+" : option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
