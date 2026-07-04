import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNowStrict, parseISO, isToday, isTomorrow } from "date-fns";
import {
  ChevronRight, MapPin, Swords, Trophy, Shuffle, Zap, Sparkles, Layers, Clock,
} from "lucide-react";
import { useMyUpcomingLeagueMatches } from "@/hooks/useMyUpcomingLeagueMatches";
import { useLeagueEntitlement } from "@/hooks/useLeagueEntitlement";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import type { LeagueType } from "@/lib/leagues/types";
import { cn } from "@/lib/utils";

/**
 * Dashboard tile — the next up-to-3 scheduled league matches the
 * player has coming up, across every league. Hides completely when
 * empty (no scheduled matches within the visible horizon).
 *
 * Deep-link: tapping a row goes to `/player/leagues/:league_id`.
 * League detail already loads the specific match into context; a
 * future `?match=xxx` deep-link can add anchoring.
 */

const TYPE_META: Record<LeagueType, { stripe: string; chip: string; icon: typeof Trophy }> = {
  singles: { stripe: "bg-blue-500",    chip: "bg-blue-500/10 text-blue-500",       icon: Zap },
  doubles: { stripe: "bg-emerald-500", chip: "bg-emerald-500/10 text-emerald-500", icon: Shuffle },
  team:    { stripe: "bg-primary",     chip: "bg-primary/10 text-primary",         icon: Trophy },
  flex:    { stripe: "bg-amber-500",   chip: "bg-amber-500/10 text-amber-500",     icon: Sparkles },
  ladder:  { stripe: "bg-violet-500",  chip: "bg-violet-500/10 text-violet-500",   icon: Layers },
};

/** Human "when" line — Today 6:30 PM / Tomorrow 6:30 PM / Sat Nov 8 · 6:30 PM */
function formatWhen(iso: string): string {
  const d = parseISO(iso);
  const time = format(d, "h:mm a");
  if (isToday(d)) return `Today · ${time}`;
  if (isTomorrow(d)) return `Tomorrow · ${time}`;
  return `${format(d, "EEE MMM d")} · ${time}`;
}

/** How-soon signal for the pulse-highlighted "next up" row. */
function isImminent(iso: string): boolean {
  const diffMs = parseISO(iso).getTime() - Date.now();
  return diffMs > 0 && diffMs < 6 * 60 * 60 * 1000; // within 6 hours
}

export function UpNextLeagueMatchesCard() {
  const navigate = useNavigate();
  const { entitled } = useLeagueEntitlement();
  const { rows, loading } = useMyUpcomingLeagueMatches(3);

  if (!entitled) return null;
  if (loading) {
    return <DashboardModuleSkeleton count={1} rowHeight="h-16" showHeader={false} />;
  }
  if (rows.length === 0) return null;

  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const meta = TYPE_META[r.league_type];
        const Icon = meta.icon;
        const soon = isImminent(r.scheduled_time);
        const teamALabel = r.team_a_name ?? "TBD";
        const teamBLabel = r.team_b_name ?? "TBD";
        return (
          <li key={r.match_id}>
            <button
              type="button"
              onClick={() => navigate(`/player/leagues/${r.league_id}`)}
              className={cn(
                "group w-full text-left rounded-xl border overflow-hidden transition-all",
                "hover:bg-accent/40 active:scale-[0.99]",
                soon
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border/60 bg-card hover:border-border",
              )}
            >
              <div className="flex items-stretch">
                <div className={cn("w-1.5 shrink-0", meta.stripe)} aria-hidden />
                <div className="flex-1 min-w-0 p-3 flex items-center gap-3">
                  <div className={cn(
                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 relative",
                    meta.chip,
                  )}>
                    {soon && (
                      <span aria-hidden className="absolute inset-0 rounded-lg bg-primary/30 animate-ping" />
                    )}
                    <Icon className="w-5 h-5 relative" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Top meta line — when + court */}
                    <div className="flex items-center gap-1.5 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className={cn(soon && "text-primary")}>
                        {formatWhen(r.scheduled_time)}
                      </span>
                      {r.court_number && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>Court {r.court_number}</span>
                        </>
                      )}
                    </div>

                    {/* Matchup line — when both team names exist, show
                        the vs. Otherwise fall back to the league name. */}
                    {r.team_a_name && r.team_b_name ? (
                      <div className="text-sm font-semibold text-foreground truncate leading-tight">
                        <Swords className="w-3.5 h-3.5 inline-block mr-1 text-muted-foreground align-[-2px]" />
                        {teamALabel} <span className="text-muted-foreground/60 font-normal">vs</span> {teamBLabel}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-foreground truncate leading-tight">
                        {r.league_name}
                      </div>
                    )}

                    {/* Sub line — league + location. Season name goes
                        after league so admins can distinguish Spring
                        vs Fall Doubles at a glance. */}
                    <div className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1.5">
                      <span className="truncate">
                        {r.league_name}{r.season_name ? ` · ${r.season_name}` : ""}
                      </span>
                      {r.location && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{r.location}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Countdown "in 2h" chip only for imminent — subtle
                      urgency signal that doesn't clutter distant rows. */}
                  {soon && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase shrink-0">
                      in {formatDistanceToNowStrict(parseISO(r.scheduled_time))}
                    </span>
                  )}

                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
