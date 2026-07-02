import { useNavigate } from "react-router-dom";
import { ChevronRight, ListChecks, Trophy } from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";

/**
 * Dashboard tile for League Play (Phase 1 player-facing).
 *
 * Renders nothing when the user has zero active memberships — the
 * feature is invite-only and we don't want to advertise emptiness.
 */
export function MyLeaguesCard() {
  const navigate = useNavigate();
  const { rows, loading } = useMyLeagues();

  if (loading) {
    return <DashboardModuleSkeleton count={1} rowHeight="h-16" showHeader={false} />;
  }

  // Hide entirely when the user has no leagues. Prevents empty
  // teasing of a feature that is fully invite-based today.
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-2">
      {rows.slice(0, 3).map(({ league, season, division, membership }) => (
        <li key={membership.id}>
          <button
            type="button"
            onClick={() => navigate(`/player/leagues/${league.id}`)}
            className="w-full text-left rounded-xl border border-border/70 bg-card p-3 hover:bg-muted/50 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{league.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {season?.name ?? "No season set"}
                  {division && ` · ${division.name}`}
                  {membership.role !== "player" && (
                    <span className="ml-1 uppercase tracking-wider text-[10px] font-bold text-primary">
                      · {membership.role}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </button>
        </li>
      ))}

      {rows.length > 3 && (
        <li>
          <button
            type="button"
            onClick={() => navigate("/player/leagues")}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ListChecks className="w-3.5 h-3.5" />
            View all {rows.length} leagues
          </button>
        </li>
      )}
    </ul>
  );
}
