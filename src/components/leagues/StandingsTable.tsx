import { Trophy, Flag } from "lucide-react";
import type { StandingRow, FormResult } from "@/lib/leagues/standings";
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
      <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem_3rem] sm:grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3.5rem_3.5rem_5.5rem] items-center gap-2 sm:gap-3 px-3 py-2 bg-muted/40 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
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
        <div className="text-right hidden sm:block">Form</div>
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
                "grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem_3rem] sm:grid-cols-[2.5rem_1fr_3rem_3rem_3rem_3.5rem_3.5rem_5.5rem] items-center gap-2 sm:gap-3 px-3 py-2.5 border-b border-border/40 last:border-b-0 tabular-nums text-sm",
                highlighted && "bg-primary/5",
              )}
            >
              <div className="text-center">
                <RankBadge rank={rank} />
              </div>
              <div
                className={cn(
                  "min-w-0 flex items-center gap-1.5",
                  highlighted && "text-primary font-bold",
                )}
                title={row.teamName}
              >
                <span className={cn("truncate font-medium",
                  highlighted && "font-bold",
                )}>{row.teamName}</span>
                {(row.forfeitWins > 0 || row.forfeitLosses > 0) && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 shrink-0"
                    title={`${row.forfeitWins} forfeit win${row.forfeitWins === 1 ? "" : "s"}, ${row.forfeitLosses} forfeit loss${row.forfeitLosses === 1 ? "" : "es"}`}
                  >
                    <Flag className="w-3 h-3" />
                    {row.forfeitWins + row.forfeitLosses}
                  </span>
                )}
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
              <div className="hidden sm:flex items-center justify-end gap-0.5">
                <FormChips form={row.recentForm} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Last-N form chips. Empty pips fill from the right so a team with
 * only 2 results renders 3 empty + 2 filled — the trailing edge is
 * "most recent". Uses per-outcome tone: W = emerald, L = destructive,
 * FW = amber, FL = amber (dim), — no result → muted skeleton pip.
 */
function FormChips({ form }: { form: FormResult[] }) {
  const CAP = 5;
  const padded: (FormResult | null)[] = [
    ...Array<FormResult | null>(Math.max(0, CAP - form.length)).fill(null),
    ...form,
  ];
  return (
    <>
      {padded.map((r, i) => (
        <span
          key={i}
          className={cn(
            "inline-flex items-center justify-center h-4 w-4 rounded text-[9px] font-bold leading-none",
            r === "W"  && "bg-emerald-500/20 text-emerald-600",
            r === "L"  && "bg-destructive/15 text-destructive",
            r === "FW" && "bg-amber-500/20 text-amber-600",
            r === "FL" && "bg-amber-500/10 text-amber-500/70",
            r === null && "bg-muted/60 text-muted-foreground/40",
          )}
          title={
            r === "W"  ? "Win" :
            r === "L"  ? "Loss" :
            r === "FW" ? "Won by forfeit" :
            r === "FL" ? "Lost by forfeit" :
            "No result yet"
          }
        >
          {r === null ? "·" : r === "FW" ? "F" : r === "FL" ? "F" : r}
        </span>
      ))}
    </>
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
