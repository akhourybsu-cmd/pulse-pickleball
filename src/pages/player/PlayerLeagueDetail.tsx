import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, MapPin, Trophy, Shuffle, Zap, Sparkles, Layers,
  CalendarDays, Users, UsersRound, CalendarClock, Crown,
  Swords, Settings,
} from "lucide-react";
import { useMemo } from "react";
import type { LeagueType, LeagueMatchStatus } from "@/lib/leagues/types";
import { useLeagueDetailForPlayer } from "@/hooks/useLeagueDetailForPlayer";
import { computeTeamStandings } from "@/lib/leagues/standings";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { LeagueMatchActions } from "@/components/leagues/LeagueMatchActions";
import { cn } from "@/lib/utils";

const TYPE_META: Record<LeagueType, { stripe: string; pill: string; icon: typeof Trophy; label: string }> = {
  singles: {
    stripe: "bg-blue-500",
    pill: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
    icon: Zap, label: "Singles",
  },
  doubles: {
    stripe: "bg-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    icon: Shuffle, label: "Doubles",
  },
  team: {
    stripe: "bg-[#A6DB5A]",
    pill: "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
    icon: Trophy, label: "Team",
  },
  flex: {
    stripe: "bg-amber-500",
    pill: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
    icon: Sparkles, label: "Flex",
  },
  ladder: {
    stripe: "bg-violet-500",
    pill: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
    icon: Layers, label: "Ladder",
  },
};

const MATCH_STATUS_TONE: Record<LeagueMatchStatus, string> = {
  scheduled:       "bg-muted text-muted-foreground",
  in_progress:     "bg-primary/15 text-primary",
  score_submitted: "bg-amber-500/15 text-amber-600",
  verified:        "bg-emerald-500/15 text-emerald-500",
  disputed:        "bg-destructive/15 text-destructive",
  canceled:        "bg-slate-500/15 text-slate-500",
  forfeit:         "bg-slate-500/15 text-slate-500",
};

export default function PlayerLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const detail = useLeagueDetailForPlayer(leagueId);
  const {
    league, membership, season, division, myTeams, myTeamIds,
    teammates, matches, allMatches, allTeams, teamsById, loading,
    currentUserId, refresh,
  } = detail;

  // Standings scoped to my current season + division. Falls back to
  // whole-league if I don't have a season/division set yet.
  const standings = useMemo(
    () => computeTeamStandings(allMatches, allTeams, {
      seasonId: season?.id ?? undefined,
      divisionId: division?.id ?? undefined,
    }),
    [allMatches, allTeams, season?.id, division?.id],
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!league) {
    return (
      <div className="container mx-auto px-4 py-10 text-center max-w-md">
        <p className="text-sm font-medium">League not available</p>
        <p className="text-xs text-muted-foreground mt-1">
          This league might have ended or your membership isn't active.
        </p>
        <Button
          size="sm" variant="outline" className="mt-4"
          onClick={() => navigate("/player/leagues")}
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to my leagues
        </Button>
      </div>
    );
  }

  const meta = TYPE_META[league.league_type];
  const Icon = meta.icon;

  // Split matches into upcoming (no result yet) and past (either
  // scored or in a terminal non-scored state like canceled/forfeit).
  const now = Date.now();
  const upcoming = matches.filter((m) => {
    if (m.team_a_score !== null && m.team_b_score !== null) return false;
    if (m.status === "canceled" || m.status === "forfeit") return false;
    if (m.scheduled_time && new Date(m.scheduled_time).getTime() < now - 24 * 3600 * 1000) {
      return false;
    }
    return true;
  });
  const past = matches
    .filter((m) => !upcoming.includes(m))
    .sort((a, b) => {
      const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : 0;
      const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : 0;
      return tb - ta;
    });

  // Group teammates by team_id — a player can be on more than one team.
  const teammatesByTeam = new Map<string, typeof teammates>();
  teammates.forEach((t) => {
    const arr = teammatesByTeam.get(t.team_id) ?? [];
    arr.push(t);
    teammatesByTeam.set(t.team_id, arr);
  });

  return (
    <div className="container mx-auto px-4 py-5 max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost" size="sm" onClick={() => navigate("/player/leagues")}
          className="-ml-2 h-8"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          My leagues
        </Button>
        {/* Manage CTA — appears only for the league owner. RLS also
            enforces this server-side; the client check just hides the
            button when it wouldn't do anything. */}
        {currentUserId && league.created_by === currentUserId && (
          <Button
            size="sm" variant="outline"
            onClick={() => navigate(`/player/leagues/${league.id}/manage`)}
            className="h-8"
          >
            <Settings className="w-4 h-4 mr-1.5" />
            Manage
          </Button>
        )}
      </div>

      {/* Sporty hero */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38]">
        <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", meta.stripe)} aria-hidden />
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
             style={{
               backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
               color: "#A6DB5A",
             }}
             aria-hidden />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
              meta.pill,
            )}>
              <Icon className="w-3 h-3" />
              {meta.label}
            </span>
            {membership && membership.role !== "player" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30">
                You're {membership.role}
              </span>
            )}
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            {league.name}
          </h1>
          {league.description && (
            <p className="text-slate-400 text-sm mt-2 max-w-2xl">
              {league.description}
            </p>
          )}
          {league.location && (
            <div className="text-xs text-slate-400 mt-2 inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {league.location}
            </div>
          )}
        </div>
      </div>

      {/* Your spot */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Your spot in this league
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<CalendarDays className="w-4 h-4" />} label="Season"
                   value={season?.name ?? "Not assigned"} />
          <InfoRow icon={<Users className="w-4 h-4" />} label="Division"
                   value={division?.name ?? "Not assigned"} />
          <InfoRow icon={<Trophy className="w-4 h-4" />} label="Role"
                   value={membership?.role ?? "player"} />
          <InfoRow icon={<UsersRound className="w-4 h-4" />} label="Teams"
                   value={myTeams.length === 0
                     ? "Not on a team yet"
                     : myTeams.map((t) => t.name).join(", ")} />
        </div>
      </div>

      {/* Teammates — one section per team the player is on */}
      {myTeams.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <UsersRound className="w-3.5 h-3.5" />
            Team roster
          </h2>
          {myTeams.map((team) => {
            const roster = teammatesByTeam.get(team.id) ?? [];
            return (
              <div key={team.id} className="space-y-2">
                {myTeams.length > 1 && (
                  <div className="text-sm font-semibold">{team.name}</div>
                )}
                {roster.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Just you on the roster so far.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {roster
                      // Show captain first, then me, then others alphabetically.
                      .sort((a, b) => {
                        if (a.is_captain !== b.is_captain) return a.is_captain ? -1 : 1;
                        if (a.is_me !== b.is_me) return a.is_me ? -1 : 1;
                        return a.display_name.localeCompare(b.display_name);
                      })
                      .map((tm) => (
                        <li
                          key={tm.team_member_id}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/50 px-3 py-2",
                            tm.is_me && "border-primary/40 bg-primary/5",
                          )}
                        >
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                            {tm.avatar_url ? (
                              <img src={tm.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="text-[10px] font-bold text-muted-foreground">
                                {tm.display_name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-medium truncate">
                                {tm.is_me ? "You" : tm.display_name}
                              </span>
                              {tm.is_captain && (
                                <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Captain" />
                              )}
                            </div>
                            {tm.role !== "player" && (
                              <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                                {tm.role}
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Standings — only render if there's anything to show */}
      {standings.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Standings
              {division && (
                <span className="text-muted-foreground/70 normal-case font-medium">
                  · {division.name}
                </span>
              )}
            </h2>
          </div>
          <StandingsTable
            rows={standings}
            highlightTeamIds={myTeamIds}
            emptyMessage="No completed matches yet."
          />
        </div>
      )}

      {/* Upcoming matches */}
      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          Upcoming matches
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No upcoming matches yet. Your organizer will schedule matches as
            the season gets going.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                teamsById={teamsById}
                currentUserId={currentUserId}
                onChanged={refresh}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Past matches (only if any) */}
      {past.length > 0 && (
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Swords className="w-3.5 h-3.5" />
            Past matches
          </h2>
          <ul className="space-y-2">
            {past.map((m) => (
              <MatchRow
                key={m.id}
                match={m}
                teamsById={teamsById}
                currentUserId={currentUserId}
                onChanged={refresh}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoRow({
  icon, label, value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
          {label}
        </div>
        <div className="text-sm font-medium truncate">{value}</div>
      </div>
    </div>
  );
}

function MatchRow({
  match, teamsById, currentUserId, onChanged,
}: {
  match: import("@/lib/leagues/types").LeagueMatch;
  teamsById: Record<string, import("@/lib/leagues/types").LeagueTeam>;
  currentUserId: string | null;
  onChanged: () => void;
}) {
  const teamA = match.team_a_id ? teamsById[match.team_a_id] : null;
  const teamB = match.team_b_id ? teamsById[match.team_b_id] : null;
  const scoreShown =
    match.team_a_score !== null && match.team_b_score !== null;
  const aWon = scoreShown && (match.team_a_score ?? 0) > (match.team_b_score ?? 0);
  const bWon = scoreShown && (match.team_b_score ?? 0) > (match.team_a_score ?? 0);

  return (
    <li className="rounded-lg border border-border/70 bg-background/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b border-border/40">
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground">
          <span className={cn(
            "font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
            MATCH_STATUS_TONE[match.status],
          )}>{match.status.replace("_", " ")}</span>
          {match.scheduled_time && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {new Date(match.scheduled_time).toLocaleString(undefined, {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </span>
          )}
          {match.court_number && <span>· Court {match.court_number}</span>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-3">
        <div className={cn(
          "text-sm truncate text-right",
          aWon ? "font-bold text-primary" : "font-medium",
        )}>
          {teamA?.name ?? (match.team_a_id ? "Opponent" : "TBD")}
        </div>
        <div className="flex items-center gap-2 font-black tabular-nums">
          {scoreShown ? (
            <>
              <span className={cn(
                "text-xl leading-none",
                aWon ? "text-primary" : "text-muted-foreground",
              )}>{match.team_a_score}</span>
              <span className="text-muted-foreground text-xs font-bold">–</span>
              <span className={cn(
                "text-xl leading-none",
                bWon ? "text-primary" : "text-muted-foreground",
              )}>{match.team_b_score}</span>
            </>
          ) : (
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
              vs
            </span>
          )}
        </div>
        <div className={cn(
          "text-sm truncate text-left",
          bWon ? "font-bold text-primary" : "font-medium",
        )}>
          {teamB?.name ?? (match.team_b_id ? "Opponent" : "TBD")}
        </div>
      </div>

      {/* Score entry / verify / dispute actions. Every match on the
          player league page is one the player participates in — the
          hook pre-filters, so isParticipant is always true here. */}
      {currentUserId && (
        <div className="px-3 pb-3 pt-1 border-t border-border/30 bg-muted/10">
          <LeagueMatchActions
            match={match}
            teamsById={teamsById}
            currentUserId={currentUserId}
            isParticipant
            onChanged={onChanged}
          />
        </div>
      )}
    </li>
  );
}
