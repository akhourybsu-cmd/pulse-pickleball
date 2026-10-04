import { LeagueBrandMark } from "@/components/leagues/LeagueIdentity";
import { normalizeHex } from "@/lib/venues/branding";
import { playerLeaguePath } from "@/lib/leagues/playerNavigation";
import { upcomingLeagueDate, upcomingLeagueWhen } from "@/lib/leagues/upcoming";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  ChevronRight, MapPin, Swords, Clock,
} from "lucide-react";
import { useMyUpcomingLeagueMatches } from "@/hooks/useMyUpcomingLeagueMatches";
import { useLeagueEntitlement } from "@/hooks/useLeagueEntitlement";
import { DashboardModuleSkeleton } from "@/components/layout/DashboardModuleSkeleton";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { cn } from "@/lib/utils";

/**
 * Dashboard tile — the next up-to-3 scheduled league matches the
 * player has coming up, across every league. Hides completely when
 * empty (no scheduled matches within the visible horizon).
 *
 * Tapping a row opens game day in the season displayed on the card.
 */

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
        const meta = LEAGUE_TYPE_META[r.league_type];
        const date = upcomingLeagueDate(r);
        const diff = date ? date.getTime() - Date.now() : -1;
        const soon = diff > 0 && diff < 6 * 60 * 60 * 1000 && !(r.has_match_time === false && !r.session_start_time);
        const teamALabel = r.team_a_name ?? "TBD";
        const teamBLabel = r.team_b_name ?? "TBD";
        return (
          <li key={r.match_id}>
            <button
              type="button"
              onClick={() => navigate(`${playerLeaguePath(r.league_id, r.season_id)}#gameday`)}
              className={cn(
                "group w-full text-left rounded-xl border overflow-hidden transition-all",
                "hover:bg-accent/40 active:scale-[0.99]",
                soon
                  ? "border-primary/40 bg-primary/[0.03]"
                  : "border-border/60 bg-card hover:border-border",
              )}
            >
              <div className="flex items-stretch">
                <div className={cn("w-1.5 shrink-0", meta.stripe)} style={{ background: normalizeHex(r.league_branding?.primary_color) ?? undefined }} aria-hidden />
                <div className="flex-1 min-w-0 p-3 flex items-center gap-3">
                  <LeagueBrandMark name={r.league_name} branding={r.league_branding} className="h-10 w-10 text-[40px]" />

                  <div className="min-w-0 flex-1">
                    {/* Top meta line — when + court */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span className={cn(soon && "text-primary")}>
                        {upcomingLeagueWhen(r)}
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
                      <div className="text-sm font-semibold text-foreground line-clamp-2 break-words leading-snug">
                        <Swords className="w-3.5 h-3.5 inline-block mr-1 text-muted-foreground align-[-2px]" />
                        {teamALabel} <span className="text-muted-foreground/60 font-normal">vs</span> {teamBLabel}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-foreground line-clamp-2 break-words leading-snug">
                        {r.league_name}
                      </div>
                    )}

                    {/* Sub line — league + location. Season name goes
                        after league so admins can distinguish Spring
                        vs Fall Doubles at a glance. */}
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <span className="block line-clamp-2 break-words">
                        {r.league_name}{r.season_name ? ` · ${r.season_name}` : ""}
                      </span>
                      {r.location && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{r.location}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Countdown "in 2h" chip only for imminent — subtle
                      urgency signal that doesn't clutter distant rows. */}
                  {soon && (
                    <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-bold tracking-wider uppercase shrink-0">
                      in {formatDistanceToNowStrict(date!)}
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
