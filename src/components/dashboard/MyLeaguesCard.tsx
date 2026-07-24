import { useNavigate } from "react-router-dom";
import {
  ChevronRight, ListChecks, Trophy, Shuffle, Zap, Sparkles, Layers,
  KeyRound, CalendarDays, Crown,
} from "lucide-react";
import { useMyLeagues } from "@/hooks/useMyLeagues";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { Button } from "@/components/ui/button";
import type { LeagueType } from "@/lib/leagues/types";
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

const TYPE_META: Record<LeagueType, { stripe: string; chip: string; icon: typeof Trophy; label: string }> = {
  singles: { stripe: "bg-blue-500",    chip: "bg-blue-500/10 text-blue-500",       icon: Zap,      label: "Singles" },
  doubles: { stripe: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-500", icon: Shuffle,  label: "Doubles" },
  team:    { stripe: "bg-primary",     chip: "bg-primary/10 text-primary",         icon: Trophy,   label: "Team" },
  flex:    { stripe: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-500",     icon: Sparkles, label: "Flex" },
  ladder:  { stripe: "bg-violet-500",  chip: "bg-violet-500/10 text-violet-500",   icon: Layers,   label: "Ladder" },
};

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
      {visible.map(({ league, season, membership }) => {
        const meta = TYPE_META[league.league_type];
        const Icon = meta.icon;
        const isOfficer = membership.role !== "player";

        return (
          <button
            key={membership.id}
            type="button"
            onClick={() => navigate(`/player/leagues/${league.id}`)}
            className={cn(
              "w-full text-left rounded-xl border border-border/60 bg-card overflow-hidden group",
              "hover:bg-accent/40 hover:border-border active:scale-[0.99] transition-all",
            )}
          >
            <div className="flex items-stretch">
              {/* Type-accent side rail — same language as the /player/leagues
                  page so the card and the hub feel like one system. */}
              <div className={cn("w-1.5 shrink-0", meta.stripe)} aria-hidden />
              <div className="flex-1 min-w-0 px-3 py-3 flex items-center gap-3">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  meta.chip,
                )}>
                  <Icon className="w-5 h-5" />
                </div>
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
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate leading-tight">
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
