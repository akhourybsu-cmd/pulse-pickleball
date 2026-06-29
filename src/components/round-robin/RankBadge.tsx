import { cn } from "@/lib/utils";

interface RankBadgeProps {
  /** 1-based rank. 1-3 get medal-tinted treatments; 4+ gets neutral. */
  rank: number;
  /** "chip" (default) = small numeric badge; "tile" = large hero-tile badge. */
  variant?: "chip" | "tile";
  className?: string;
}

/**
 * Rank indicator for standings.
 *
 * Replaces the 🥇🥈🥉 emoji medals that read inconsistently across
 * platforms (and look more "kid's app" than premium). Same gold /
 * silver / bronze tonal coding, but rendered as a typed chip with the
 * actual rank number — works at every rank, not just the top three,
 * and stays crisp at small sizes.
 *
 * `chip`  — 28px circular pill, used inline in the standings table.
 * `tile`  — large medal-style badge for the Top-3 podium cards.
 */
export function RankBadge({ rank, variant = "chip", className }: RankBadgeProps) {
  const isTopThree = rank >= 1 && rank <= 3;

  // Tonal palette per rank — uses the same warm/silver/bronze hues as
  // the prior treatment but expressed as background + ring + text so
  // the badge holds shape with or without an emoji glyph.
  const tone =
    rank === 1
      ? "bg-amber-100 text-amber-700 ring-amber-400/60 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/40"
      : rank === 2
        ? "bg-slate-100 text-slate-700 ring-slate-400/60 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/40"
        : rank === 3
          ? "bg-orange-100 text-orange-700 ring-orange-400/60 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/40"
          : "bg-muted text-muted-foreground ring-border";

  if (variant === "tile") {
    return (
      <div
        className={cn(
          "inline-flex h-12 w-12 items-center justify-center rounded-full ring-2 font-bold text-xl tabular-nums",
          tone,
          className,
        )}
        aria-label={`Rank ${rank}`}
      >
        {rank}
      </div>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold tabular-nums",
        isTopThree ? "ring-1" : "ring-1",
        tone,
        className,
      )}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}
