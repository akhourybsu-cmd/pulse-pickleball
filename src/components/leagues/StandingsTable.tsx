import { Trophy } from "lucide-react";
import type { StandingRow } from "@/lib/leagues/standings";
import { cn } from "@/lib/utils";

/**
 * Presentation-only. Callers supply pre-computed rows so the same
 * component can render on the admin StandingsTab AND on the player
 * league detail page. The `highlightTeamIds` set lets the player
 * surface subtly highlight rows for the current player's own team(s).
 */
export function StandingsTable({
  rows,
  highlightTeamIds,
  emptyMessage = "No results yet.",
}: {
  rows: StandingRow[];
  highlightTeamIds?: Set<string>;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center">
        <Trophy className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_3rem] sm:grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3.5rem_3.5rem] items-center gap-2 sm:gap-3 px-3 py-2 bg-muted/40 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <div className="text-center">#</div>
        <div>Team</div>
        <div className="text-right">W</div>
        <div className="text-right">L</div>
        <div className="text-right hidden sm:block">GP</div>
        <div className="text-right">
          <span className="sm:hidden">±</span>
          <span className="hidden sm:inline">Diff</span>
        </div>
        <div className="text-right">Win%</div>
      </div>

      {/* Rows */}
      <ul>
        {rows.map((row, i) => {
          const highlighted = highlightTeamIds?.has(row.teamId);
          const rank = i + 1;
          return (
            <li
              key={row.teamId}
              className={cn(
                "grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_3rem] sm:grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3.5rem_3.5rem] items-center gap-2 sm:gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0 tabular-nums text-sm",
                highlighted && "bg-primary/5",
              )}
            >
              <div className="text-center">
                <RankBadge rank={rank} />
              </div>
              <div
                className={cn(
                  "truncate font-medium",
                  highlighted && "text-primary font-bold",
                )}
                title={row.teamName}
              >
                {row.teamName}
              </div>
              <div className="text-right font-bold">{row.wins}</div>
              <div className="text-right text-muted-foreground">{row.losses}</div>
              <div className="text-right text-muted-foreground hidden sm:block">
                {row.gamesPlayed}
              </div>
              <div
                className={cn(
                  "text-right font-mono text-xs",
                  row.pointDiff > 0 && "text-emerald-600",
                  row.pointDiff < 0 && "text-destructive",
                  row.pointDiff === 0 && "text-muted-foreground",
                )}
              >
                {row.pointDiff > 0 ? "+" : ""}
                {row.pointDiff}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                {(row.winPct * 100).toFixed(0)}%
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  // Top 3 get subtle gold / silver / bronze tint. Everyone else is
  // muted text.
  const tone =
    rank === 1
      ? "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30"
      : rank === 2
      ? "bg-slate-400/20 text-slate-500 ring-1 ring-slate-400/40"
      : rank === 3
      ? "bg-orange-500/15 text-orange-600 ring-1 ring-orange-500/30"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-[11px] font-bold h-6 w-6",
        tone,
      )}
    >
      {rank}
    </span>
  );
}
