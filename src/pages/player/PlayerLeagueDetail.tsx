import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Trophy,
  CalendarDays, Users, CalendarClock,
  Swords, Settings,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueMatchStatus } from "@/lib/leagues/types";
import { useLeagueDetailForPlayer } from "@/hooks/useLeagueDetailForPlayer";
import { sideName } from "@/lib/leagues/matchSides";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { computePlayerStandings, computeTeamStandings } from "@/lib/leagues/standings";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { LadderSubRequestCard } from "@/components/leagues/LadderSubRequestCard";
import { LeagueMatchActions } from "@/components/leagues/LeagueMatchActions";
import { LadderTiebreakPrompt } from "@/components/leagues/LadderTiebreakPrompt";
import { LeagueScope, LeagueHero, LgSectionHeader } from "@/components/leagues/_leagueScope";
import { cn } from "@/lib/utils";

const MATCH_STATUS_TONE: Record<LeagueMatchStatus, string> = {
  scheduled:       "bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text-dim)]",
  in_progress:     "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  score_submitted: "bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-gold-bright)]",
  verified:        "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  disputed:        "bg-destructive/20 text-destructive",
  canceled:        "bg-muted text-muted-foreground",
  forfeit:         "bg-muted text-muted-foreground",
};

export default function PlayerLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const detail = useLeagueDetailForPlayer(leagueId);
  const {
    league, membership, season,
    matches, allMatches, allTeams, teamsById, playersById, teammates,
    myTeams, loading,
    currentUserId, refresh,
  } = detail;

  const isTeamMode =
    league?.league_type === "doubles" || league?.league_type === "team";

  // Fetch manager display name for the hero.
  const [managerName, setManagerName] = useState<string | null>(null);
  useEffect(() => {
    if (!league?.created_by) return;
    (async () => {
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("display_name, full_name, first_name, last_name")
        .eq("id", league.created_by)
        .maybeSingle();
      if (data) {
        const p = data as { display_name?: string | null; full_name?: string | null; first_name?: string | null; last_name?: string | null };
        setManagerName(
          p.display_name
            || p.full_name
            || [p.first_name, p.last_name].filter(Boolean).join(" ")
            || null,
        );
      }
    })();
  }, [league?.created_by]);

  const standings = useMemo(() => {
    if (!league) return [];
    if (isTeamMode) {
      return computeTeamStandings(allMatches, allTeams, { seasonId: season?.id ?? undefined });
    }
    return computePlayerStandings(
      allMatches,
      (id) => (playersById[id] ? resolvePlayerName(playersById[id]) : "Player"),
      { seasonId: season?.id ?? undefined },
    );
  }, [allMatches, allTeams, playersById, season?.id, isTeamMode, league]);

  const myTeamIdSet = useMemo(() => new Set(myTeams.map((t) => t.id)), [myTeams]);
  const myRow = isTeamMode
    ? standings.find((r) => myTeamIdSet.has(r.teamId))
    : standings.find((r) => r.teamId === currentUserId);

  if (loading) {
    return (
      <LeagueScope>
        <div className="container mx-auto px-4 py-10 text-center text-[color:var(--lg-text-dim)] text-sm">
          Loading…
        </div>
      </LeagueScope>
    );
  }

  if (!league) {
    return (
      <LeagueScope>
        <div className="container mx-auto px-4 py-10 text-center max-w-md">
          <p className="text-sm font-medium text-[color:var(--lg-text)]">League not available</p>
          <p className="text-xs text-[color:var(--lg-text-dim)] mt-1">
            This league might have ended or your membership isn't active.
          </p>
          <Button
            size="sm" variant="outline" className="mt-4 border-[color:var(--lg-gold)]/50 text-[color:var(--lg-gold-bright)]"
            onClick={() => navigate("/player/leagues")}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to my leagues
          </Button>
        </div>
      </LeagueScope>
    );
  }

  // Split matches into upcoming (no result yet) and past.
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

  const record = myRow ? `${myRow.wins}–${myRow.losses}` : "0–0";
  const isOrganizer = currentUserId != null && league.created_by === currentUserId;

  return (
    <LeagueScope>
      <div className="container mx-auto px-4 py-5 max-w-3xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost" size="sm" onClick={() => navigate("/player/leagues")}
            className="-ml-2 h-8 text-[color:var(--lg-text-dim)] hover:text-[color:var(--lg-text)] hover:bg-[color:var(--lg-surface-2)]"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            My leagues
          </Button>
          {isOrganizer && (
            <Button
              size="sm" variant="outline"
              onClick={() => navigate(`/player/leagues/${league.id}/manage`)}
              className="h-8 border-[color:var(--lg-gold)]/50 bg-transparent text-[color:var(--lg-gold-bright)] hover:bg-[color:var(--lg-gold)]/10"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Manage
            </Button>
          )}
        </div>

        <LeagueHero
          league={league}
          managerName={managerName}
          eyebrow={
            membership && membership.role !== "player" ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-[0.14em] bg-[color:var(--lg-hero-chip-bg)] text-[color:var(--lg-hero-gold)] ring-1 ring-[color:var(--lg-hero-chip-ring)]">
                You're {membership.role}
              </span>
            ) : undefined
          }
          kpis={[
            { icon: CalendarDays, label: "Season", value: season?.name ?? "—" },
            { icon: Trophy, label: "Role", value: (membership?.role ?? "player") },
            { icon: Swords, label: "Record", value: record },
          ]}
        />

        {league.league_type === "ladder" && (
          <LadderSubRequestCard
            leagueId={league.id}
            seasonId={season?.id ?? null}
            currentUserId={currentUserId}
          />
        )}

        {standings.length > 0 && (
          <div className="lg-card p-4 space-y-3">
            <LgSectionHeader icon={Trophy} className="mb-0">Standings</LgSectionHeader>
            <StandingsTable
              rows={standings}
              nameHeader={isTeamMode ? "Team" : "Player"}
              highlightTeamIds={
                isTeamMode
                  ? (myTeamIdSet.size ? myTeamIdSet : undefined)
                  : (currentUserId ? new Set([currentUserId]) : undefined)
              }
              emptyMessage="No completed matches yet."
            />
          </div>
        )}

        {isTeamMode && teammates.length > 0 && (
          <div className="lg-card p-4">
            <LgSectionHeader icon={Users}>
              Your team{myTeams.length === 1 ? "" : "s"}
              {myTeams.length === 1 && (
                <span className="ml-1 text-[color:var(--lg-text-dim)] normal-case font-medium tracking-normal">
                  · {myTeams[0].name}
                </span>
              )}
            </LgSectionHeader>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {teammates.map((tm) => (
                <li
                  key={tm.team_member_id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2",
                    tm.is_me && "ring-1 ring-[color:var(--lg-gold)]/40",
                  )}
                >
                  <div className="h-8 w-8 rounded-full bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)] flex items-center justify-center text-xs font-bold shrink-0">
                    {tm.display_name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate text-[color:var(--lg-text)]">
                      {tm.display_name}
                      {tm.is_me && <span className="text-[color:var(--lg-text-dim)] font-normal"> · you</span>}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)]">
                      {tm.is_captain ? "Captain" : tm.role}
                      {myTeams.length > 1 && ` · ${tm.team_name}`}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {league?.league_type === "ladder" && leagueId && (
          <LadderTiebreakPrompt
            leagueId={leagueId}
            playersById={playersById}
            onResolved={refresh}
          />
        )}

        <div className="lg-card p-4">
          <LgSectionHeader icon={CalendarClock}>Upcoming matches</LgSectionHeader>
          {upcoming.length === 0 ? (
            <p className="text-xs text-[color:var(--lg-text-dim)]">
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
                  playersById={playersById}
                  currentUserId={currentUserId}
                  isLadder={league?.league_type === "ladder"}
                  onChanged={refresh}
                />
              ))}
            </ul>
          )}
        </div>

        {past.length > 0 && (
          <div className="lg-card p-4">
            <LgSectionHeader icon={Swords}>Past matches</LgSectionHeader>
            <ul className="space-y-2">
              {past.map((m) => (
                <MatchRow
                  key={m.id}
                  match={m}
                  teamsById={teamsById}
                  playersById={playersById}
                  currentUserId={currentUserId}
                  isLadder={league?.league_type === "ladder"}
                  onChanged={refresh}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </LeagueScope>
  );
}

function MatchRow({
  match, teamsById, playersById, currentUserId, isLadder, onChanged,
}: {
  match: import("@/lib/leagues/types").LeagueMatch;
  teamsById: Record<string, import("@/lib/leagues/types").LeagueTeam>;
  playersById: Record<string, { display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null }>;
  currentUserId: string | null;
  isLadder?: boolean;
  onChanged: () => void;
}) {
  const teamA = match.team_a_id ? teamsById[match.team_a_id] : null;
  const teamB = match.team_b_id ? teamsById[match.team_b_id] : null;
  const nameOf = (id: string | null): string | null =>
    id ? (playersById[id] ? resolvePlayerName(playersById[id]) : null) : null;
  const aName = sideName(teamA?.name ?? null, [nameOf(match.player_a_id), nameOf(match.player_b_id)]);
  const bName = sideName(teamB?.name ?? null, [nameOf(match.player_c_id), nameOf(match.player_d_id)]);
  const scoreShown =
    match.team_a_score !== null && match.team_b_score !== null;
  const aWon = scoreShown && (match.team_a_score ?? 0) > (match.team_b_score ?? 0);
  const bWon = scoreShown && (match.team_b_score ?? 0) > (match.team_a_score ?? 0);

  return (
    <li className="rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[color:var(--lg-surface)] border-b border-[color:var(--lg-border)]">
        <div className="flex items-center gap-2 flex-wrap text-[10px] text-[color:var(--lg-text-dim)]">
          <span className={cn(
            "font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded",
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
          aWon ? "font-bold text-[color:var(--lg-gold-bright)]" : "font-medium text-[color:var(--lg-text)]",
        )}>
          {aName}
        </div>
        <div className="flex items-center gap-2 lg-num">
          {scoreShown ? (
            <>
              <span className={cn(
                "text-2xl leading-none",
                aWon ? "text-[color:var(--lg-gold-bright)]" : "text-[color:var(--lg-text-dim)]",
              )}>{match.team_a_score}</span>
              <span className="text-[color:var(--lg-text-dim)] text-xs font-bold">–</span>
              <span className={cn(
                "text-2xl leading-none",
                bWon ? "text-[color:var(--lg-gold-bright)]" : "text-[color:var(--lg-text-dim)]",
              )}>{match.team_b_score}</span>
            </>
          ) : (
            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)] font-bold">
              vs
            </span>
          )}
        </div>
        <div className={cn(
          "text-sm truncate text-left",
          bWon ? "font-bold text-[color:var(--lg-gold-bright)]" : "font-medium text-[color:var(--lg-text)]",
        )}>
          {bName}
        </div>
      </div>

      {currentUserId && (
        <div className="px-3 pb-3 pt-1 border-t border-[color:var(--lg-border)] bg-[color:var(--lg-surface)]/60">
          <LeagueMatchActions
            match={match}
            teamsById={teamsById}
            currentUserId={currentUserId}
            isParticipant
            sideALabel={aName}
            sideBLabel={bName}
            ladderSeasonId={isLadder ? match.season_id : undefined}
            onChanged={onChanged}
          />
        </div>
      )}
    </li>
  );
}
