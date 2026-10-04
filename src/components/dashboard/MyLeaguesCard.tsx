import { playerLeaguePath } from "@/lib/leagues/playerNavigation";
import { LeagueBrandMark } from "@/components/leagues/LeagueIdentity";
import { normalizeHex } from "@/lib/venues/branding";
import { useNavigate } from "react-router-dom";
import {
  ChevronRight, ListChecks,
  KeyRound, CalendarDays, Crown,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { Button } from "@/components/ui/button";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { cn } from "@/lib/utils";

/**
 * Dashboard tile for League Play.
 *
 * Renders nothing when the user has zero active memberships — the
 * feature is invite-based today, so an empty state would be
 * advertising a feature the player has no way to enter without a
 * code. The "Join with code" affordance still lives on the full
 * `/player/leagues` page for players who arrive with an invite.
 *
 * Visual language mirrors MyRoundRobinsCard so Home reads as one
 * consistent activity dashboard, with a per-type accent stripe so
 * doubles / team / ladder etc. are visually distinct at a glance.
 */

export function MyLeaguesCard() {
  const navigate = useNavigate();
  const { rows, loading } = useMyLeagues();

  if (loading) {
    return <DashboardModuleSkeleton count={2} rowHeight="h-16" showHeader={false} />;
  }

  // Hide entirely when the user has no leagues. See doc comment above.
  if (rows.length === 0) return null;

  const visible = rows.slice(0, 3);

  return (
    <div className="space-y-2">
      {visible.map(({ league, season, membership, isSubstitute }) => {
        const meta = LEAGUE_TYPE_META[league.league_type];
        const isOfficer = membership.role !== "player";

        return (
          <button
            key={membership.id}
            type="button"
            onClick={() => navigate(playerLeaguePath(league.id, season?.id))}
            className={cn(
              "w-full text-left rounded-xl border border-border/60 bg-card overflow-hidden group",
              "hover:bg-accent/40 hover:border-border active:scale-[0.99] transition-all",
            )}
          >
            <div className="flex items-stretch">
              {/* Type-accent side rail — same language as the /player/leagues
                  page so the card and the hub feel like one system. */}
              <div className={cn("w-1.5 shrink-0", meta.stripe)} style={{ background: normalizeHex(league.branding?.primary_color) ?? undefined }} aria-hidden />
              <div className="flex-1 min-w-0 px-3 py-3 flex items-center gap-3">
                <LeagueBrandMark name={league.name} branding={league.branding} className="h-11 w-11 text-[44px]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {meta.label}
                    </span>
                    {isOfficer && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[9px] font-bold tracking-wider uppercase">
                        <Crown className="h-2.5 w-2.5" />
                        {membership.role}
                      </span>
                    )}
                    {isSubstitute && !isOfficer && <span className="text-[10px] font-semibold text-muted-foreground">Substitute</span>}
                  </div>
                  <div className="text-sm font-semibold text-foreground line-clamp-2 break-words leading-snug">
                    {league.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                    {season ? (
                      <>
                        <CalendarDays className="w-3 h-3 shrink-0" />
                        <span className="truncate">{season.name}</span>
                      </>
                    ) : (
                      <span className="italic">No active season yet</span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </button>
        );
      })}

      {/* Footer row: either "See all N" when the list is truncated, or a
          persistent "Join with code" affordance so invite recipients can
          jump straight to the code flow without hitting the hub first. */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {rows.length > visible.length ? (
          <button
            type="button"
            onClick={() => navigate("/player/leagues")}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          >
            <ListChecks className="w-3.5 h-3.5" />
            See all {rows.length} leagues
          </button>
        ) : (
          <span aria-hidden />
        )}
        <Button
          size="sm" variant="ghost"
          onClick={() => navigate("/player/leagues")}
          className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Join with code
        </Button>
      </div>
    </div>
  );
}
