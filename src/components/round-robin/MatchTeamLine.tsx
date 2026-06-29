import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchTeamLineProps {
  /** Short team label, e.g. "A" / "B" or "1" / "2". */
  label: string;
  player1: string;
  player2: string;
  /** When true, the line gets the winner treatment (bold + check). */
  isWinner?: boolean;
  /** When true, the line gets a muted treatment (losing team after score). */
  isLoser?: boolean;
  className?: string;
}

/**
 * One team's name line — short label chip + two player names + an
 * optional winner mark.
 *
 * Used in dense match-card lists (round preview in ScoreManagementDialog,
 * round summaries, etc.) where a full per-player avatar treatment would
 * be too noisy. The label chip carries the team identity at a glance so
 * the names can stay neutral.
 */
export function MatchTeamLine({
  label,
  player1,
  player2,
  isWinner,
  isLoser,
  className,
}: MatchTeamLineProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 min-w-0 transition-colors",
        isLoser && "opacity-60",
        className,
      )}
    >
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold tabular-nums flex-shrink-0",
          isWinner
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "truncate text-sm",
          isWinner ? "font-semibold text-foreground" : "text-foreground/90",
        )}
      >
        {player1} <span className="text-muted-foreground">&amp;</span> {player2}
      </span>
      {isWinner && (
        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      )}
    </div>
  );
}
