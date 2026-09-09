import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import { ActionButton } from "@/components/leagues/ActionButton";
import {
  ArrowLeft, Trophy,
  CalendarDays, Users, CalendarClock,
  Swords, Settings, Gauge, ChevronRight,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueMatchStatus } from "@/lib/leagues/types";
import { useLeagueDetailForPlayer } from "@/hooks/useLeagueDetailForPlayer";
import { sideName } from "@/lib/leagues/matchSides";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { LeaguePlayerName, LeagueMatchSide } from '@/components/leagues/LeaguePlayerName';
import { leaguePlayerName, substitutePlayerIds, matchPlayerLabel } from '@/lib/leagues/playerIdentity';
import type { LeagueMatchSubstitution } from '@/lib/leagues/types';
import { computePlayerStandings, computeTeamStandings } from "@/lib/leagues/standings";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { LadderSubRequestCard } from "@/components/leagues/LadderSubRequestCard";
import { LadderMyWeekCard } from "@/components/leagues/LadderMyWeekCard";
import { LadderHowItWorks } from "@/components/leagues/LadderHowItWorks";
import { LeagueMatchActions } from "@/components/leagues/LeagueMatchActions";
import { LadderTiebreakPrompt } from "@/components/leagues/LadderTiebreakPrompt";
import { LeagueScope, LeagueHero, LgSectionHeader } from "@/components/leagues/_leagueScope";
import { cn } from "@/lib/utils";
import { SeasonSelect } from '@/components/admin/leagues/_shared';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { needsMatchAction } from '@/lib/leagues/operations';

const MATCH_STATUS_TONE: Record<LeagueMatchStatus, string> = {
  scheduled:       "bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text-dim)]",
  in_progress:     "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  score_submitted: "bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)]",
  verified:        "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  disputed:        "bg-destructive/20 text-destructive",
  canceled:        "bg-muted text-muted-foreground",
  forfeit:         "bg-muted text-muted-foreground",
};

// Plain-language labels so players don't see raw enum strings like
// "score_submitted". The badge tone above already colors the state.
const MATCH_STATUS_LABEL: Record<LeagueMatchStatus, string> = {
  scheduled:       "Scheduled",
  in_progress:     "In progress",
  score_submitted: "Awaiting confirm",
  verified:        "Final",
  disputed:        "Disputed",
  canceled:        "Canceled",
  forfeit:         "Forfeit",
};

export default function PlayerLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const reducedMotion = useReducedMotion();
  const detail = useLeagueDetailForPlayer(leagueId);
  const {
    league, membership, season,
    matches, allMatches, allTeams, teamsById, playersById, teammates, matchSubs,
    myTeams, loading,
    currentUserId, refresh, error, canManage, seasons, setSeasonId, sessions, isActiveParticipant,
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

  // Inbound deep-link: if the URL carries a #section, scroll to it once the
  // page has loaded and the target section has rendered.
  useEffect(() => {
    if (loading) return;
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    const el = document.getElementById(id);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ behavior: "auto", block: "start" }));
  }, [loading, location.hash]);

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

  if (error) {
    return <LeagueScope><div className="mx-auto max-w-md p-6 text-center space-y-3" role="alert">
      <h1 className="font-semibold">Couldn't load this league</h1>
      <p className="text-sm text-muted-foreground">{leagueErrorMessage(error)}</p>
      <ActionButton onClick={refresh}>Try again</ActionButton>
    </div></LeagueScope>;
  }

  if (!league) {
    return (
      <LeagueScope>
        <div className="container mx-auto px-4 py-10 text-center max-w-md">
          <p className="text-sm font-medium text-[color:var(--lg-text)]">League not available</p>
          <p className="text-xs text-[color:var(--lg-text-dim)] mt-1">
            This league might have ended or your membership isn't active.
          </p>
          <ActionButton
            size="sm" variant="outline" className="group mt-4 border-[color:var(--lg-gold)]/50 text-[color:var(--lg-accent-gold)]"
            onClick={() => navigate("/player/leagues")}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" /> Back to my leagues
          </ActionButton>
        </div>
      </LeagueScope>
    );
  }

  // Split matches into upcoming (no result yet) and past.
  const upcoming = matches.filter(needsMatchAction);
  const past = matches
    .filter((m) => !upcoming.includes(m))
    .sort((a, b) => {
      const ta = a.scheduled_time ? new Date(a.scheduled_time).getTime() : 0;
      const tb = b.scheduled_time ? new Date(b.scheduled_time).getTime() : 0;
      return tb - ta;
    });

  const record = myRow ? `${myRow.wins}–${myRow.losses}` : "0–0";
  // Anyone who can manage the league — the creator OR an assistant manager
  // (membership.role === "manager") — gets the Manage entry. Gating on the
  // creator alone locked co-organizers out of the console entirely.

  // In-page jump nav (the single-page analog of the admin tabs). Only the
  // sections that actually render are offered, and a click updates the URL
  // hash so the current view is shareable.
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };
  const sections: { id: string; label: string }[] = [
    standings.length > 0 ? { id: "standings", label: "Standings" } : null,
    isTeamMode && teammates.length > 0 ? { id: "team", label: "Team" } : null,
    { id: "upcoming", label: "Upcoming" },
    past.length > 0 ? { id: "past", label: "Past" } : null,
  ].filter((s): s is { id: string; label: string } => s !== null);

  // Brand-new member (or a season that hasn't kicked off): nothing to show in
  // standings or matches yet. Show one friendly empty state instead of a
  // stack of empty cards.
  const noActivity = standings.length === 0 && upcoming.length === 0 && past.length === 0;

  return (
    <LeagueScope>
      <div className="container mx-auto px-4 py-5 max-w-5xl space-y-5">
        <div className="flex items-center justify-between gap-2">
          <ActionButton
            variant="ghost" size="sm" onClick={() => navigate("/player/leagues")}
            className="group -ml-2 h-11 rounded-xl text-[color:var(--lg-text-dim)] hover:text-[color:var(--lg-text)] hover:bg-[color:var(--lg-surface-2)]"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />
            My leagues
          </ActionButton>
          {canManage && (
            <ActionButton
              size="sm" variant="outline"
              onClick={() => navigate(`/player/leagues/${league.id}/manage${season ? `?season=${encodeURIComponent(season.id)}` : ''}`)}
              className="h-11 rounded-xl border-[color:var(--lg-gold)]/50 bg-transparent text-[color:var(--lg-accent-gold)] hover:bg-[color:var(--lg-gold)]/10"
            >
              <Settings className="w-4 h-4 mr-1.5" />
              Manage
            </ActionButton>
          )}
        </div>

        <LeagueHero
          league={league}
          managerName={managerName}
          eyebrow={
            membership && membership.role !== "player" ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-[color:var(--lg-hero-chip-bg)] text-[color:var(--lg-hero-gold)] ring-1 ring-[color:var(--lg-hero-chip-ring)]">
                You're {membership.role}
              </span>
            ) : undefined
          }
          kpis={[
            { icon: CalendarDays, label: "Season", value: season?.name ?? "—" },
            { icon: Trophy, label: "Role", value: canManage ? "Organizer" : membership?.role ?? "Guest / substitute" },
            { icon: Swords, label: "Record", value: record },
          ]}
        />

        {seasons.length > 0 && <div className="flex flex-wrap items-center gap-3">
          <SeasonSelect seasons={seasons} value={season?.id ?? ''} onChange={setSeasonId} className="min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-sm" />
          <span className="text-xs text-muted-foreground capitalize">{season?.status} season</span>
        </div>}
        {sessions.filter(s => s.status === 'published').length > 0 && (
          <section className="lg-card p-4 space-y-3" aria-label="Season schedule">
            <LgSectionHeader icon={CalendarDays}>Scheduled play</LgSectionHeader>
            <ul className="grid gap-3 sm:grid-cols-2">
              {sessions.filter(s => s.status === 'published').sort((a,b) => (a.scheduled_date ?? '9999').localeCompare(b.scheduled_date ?? '9999')).map(s => (
                <li key={s.id} className="min-w-0 rounded-xl border border-[color:var(--lg-border)] p-3">
                  <p className="font-semibold text-sm break-words">{s.name}</p>
                  <p className="text-xs text-[color:var(--lg-text-dim)] mt-1">{s.scheduled_date ? new Date(`${s.scheduled_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date to be announced'}{s.start_time ? ` · ${s.start_time.slice(0,5)}` : ''}</p>
                  {s.location && <p className="mt-1 text-xs break-words text-[color:var(--lg-text-dim)]">{s.location}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {sections.length > 1 && (
          <nav
            aria-label="Jump to section"
            className="sticky top-[64px] sm:top-[72px] z-30 -mx-4 flex flex-wrap gap-1.5 border-b border-[color:var(--lg-border)] bg-[color:var(--lg-bg)] px-4 py-2"
          >
            {sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollToSection(s.id)}
                className="min-h-11 rounded-xl border border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] px-4 py-2 text-sm font-semibold text-[color:var(--lg-text)] transition-colors hover:bg-muted hover:border-[color:var(--lg-gold)]/40"
              >
                {s.label}
              </button>
            ))}
          </nav>
        )}

        {league.league_type === "ladder" && (
          <LadderMyWeekCard
            dataVersion={detail.dataVersion}
            seasonId={season?.id ?? null}
            currentUserId={currentUserId}
          />
        )}

        {league.league_type === "ladder" && (
          <LadderSubRequestCard
            leagueId={league.id}
            seasonId={season?.id ?? null}
            currentUserId={currentUserId}
            canRequest={membership?.status === 'active' && membership?.season_id === season?.id && league.status === 'active' && season?.status === 'active'}
          />
        )}

        {/* Format explainer — open by default for a brand-new member who hasn't
            seen any activity yet, collapsed once the league is in motion. */}
        {league.league_type === "ladder" && (
          <LadderHowItWorks defaultOpen={noActivity} />
        )}

        {standings.length > 0 && (
          <div id="standings" className="lg-card p-4 space-y-3 scroll-mt-40">
            <LgSectionHeader icon={Trophy} className="mb-0">Standings</LgSectionHeader>
            <p className="text-xs text-[color:var(--lg-text-dim)]">Confirmed results only. Scores awaiting confirmation or under review do not count yet.</p>
            <StandingsTable
              substituteIds={isTeamMode ? undefined : substitutePlayerIds(allMatches.filter(m => m.status === 'verified'), matchSubs)}
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
          <div id="team" className="lg-card p-4 scroll-mt-40">
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
                    <div className="text-sm font-semibold break-words text-[color:var(--lg-text)]">
                      <LeaguePlayerName name={tm.display_name} isSub={tm.role === 'substitute'} />
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

        {noActivity ? (
          <div id="upcoming" className="lg-card p-6 text-center scroll-mt-40">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text-dim)]">
              <CalendarClock className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-[color:var(--lg-text)]">
              {season ? "No matches scheduled yet" : "Your season hasn't started"}
            </p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-[color:var(--lg-text-dim)]">
              {season
                ? "Matches and standings will show up here as your organizer schedules play."
                : "Once your organizer starts a season and schedules play, your matches and standings appear here."}
            </p>
          </div>
        ) : (
          <>
            <div id="upcoming" className="lg-card p-4 scroll-mt-40">
              <LgSectionHeader icon={CalendarClock}>Your matches · upcoming &amp; to finish</LgSectionHeader>
              {upcoming.length === 0 ? (
                <p className="text-xs text-[color:var(--lg-text-dim)]">
                  No upcoming matches right now. Your organizer will schedule
                  matches as the season gets going.
                </p>
              ) : (
                <ul className="space-y-2">
                  {upcoming.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      substitutions={matchSubs}
                      teamsById={teamsById}
                      playersById={playersById}
                      currentUserId={currentUserId}
                      canPlay={isActiveParticipant && league.status === 'active' && season?.status === 'active' && (!m.session_id || sessions.some(s => s.id === m.session_id && s.status === 'published'))}
                      isLadder={league?.league_type === "ladder"}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              )}
            </div>

            {past.length > 0 && (
              <div id="past" className="lg-card p-4 scroll-mt-40">
                <LgSectionHeader icon={Swords}>Past matches</LgSectionHeader>
                <ul className="space-y-2">
                  {past.map((m) => (
                    <MatchRow
                      key={m.id}
                      match={m}
                      substitutions={matchSubs}
                      teamsById={teamsById}
                      playersById={playersById}
                      currentUserId={currentUserId}
                      canPlay={false}
                      isLadder={league?.league_type === "ladder"}
                      onChanged={refresh}
                    />
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {isSkillAssessmentEnabled() && (
          <button
            type="button"
            onClick={() => navigate("/player/self-assessment")}
            className="lg-card group flex w-full items-center gap-3 p-4 text-left transition-colors hover:border-[color:var(--lg-gold)]/40"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--lg-gold)]/12 text-[color:var(--lg-accent-gold)]">
              <Gauge className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-[color:var(--lg-text)]">Rate your game</div>
              <div className="text-xs text-[color:var(--lg-text-dim)]">
                Take the PULSE Skill Assessment for your Self-Assessed Level &amp; Skill Fingerprint.
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--lg-text-dim)] transition-transform motion-safe:group-hover:translate-x-0.5" />
          </button>
        )}
      </div>
    </LeagueScope>
  );
}

function MatchRow({
  match, teamsById, playersById, currentUserId, isLadder, canPlay, onChanged, substitutions,
}: {
  match: import("@/lib/leagues/types").LeagueMatch;
  substitutions: LeagueMatchSubstitution[];
  teamsById: Record<string, import("@/lib/leagues/types").LeagueTeam>;
  playersById: Record<string, { display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null }>;
  currentUserId: string | null;
  isLadder?: boolean;
  canPlay: boolean;
  onChanged: () => void;
}) {
  const teamA = match.team_a_id ? teamsById[match.team_a_id] : null;
  const teamB = match.team_b_id ? teamsById[match.team_b_id] : null;
  const nameOf = (id: string | null): string | null =>
    id ? matchPlayerLabel(match, id, leaguePlayerName(playersById[id]), substitutions) : null;
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
          )}>{MATCH_STATUS_LABEL[match.status] ?? match.status.replace("_", " ")}</span>
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
          "text-sm min-w-0 break-words text-right",
          aWon ? "font-bold text-[color:var(--lg-accent-gold)]" : "font-medium text-[color:var(--lg-text)]",
        )}>
          <LeagueMatchSide match={match} ids={[match.player_a_id, match.player_b_id]} nameOf={id => leaguePlayerName(playersById[id])} substitutions={substitutions} teamName={teamA?.name} />
        </div>
        <div className="flex items-center gap-2 lg-num">
          {scoreShown ? (
            <>
              <span className={cn(
                "text-2xl leading-none",
                aWon ? "text-[color:var(--lg-accent-gold)]" : "text-[color:var(--lg-text-dim)]",
              )}>{match.team_a_score}</span>
              <span className="text-[color:var(--lg-text-dim)] text-xs font-bold">–</span>
              <span className={cn(
                "text-2xl leading-none",
                bWon ? "text-[color:var(--lg-accent-gold)]" : "text-[color:var(--lg-text-dim)]",
              )}>{match.team_b_score}</span>
            </>
          ) : (
            <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)] font-bold">
              vs
            </span>
          )}
        </div>
        <div className={cn(
          "text-sm min-w-0 break-words text-left",
          bWon ? "font-bold text-[color:var(--lg-accent-gold)]" : "font-medium text-[color:var(--lg-text)]",
        )}>
          <LeagueMatchSide match={match} ids={[match.player_c_id, match.player_d_id]} nameOf={id => leaguePlayerName(playersById[id])} substitutions={substitutions} teamName={teamB?.name} />
        </div>
      </div>

      {currentUserId && (
        <div className="px-3 pb-3 pt-1 border-t border-[color:var(--lg-border)] bg-[color:var(--lg-surface)]/60">
          <LeagueMatchActions
            match={match}
            teamsById={teamsById}
            currentUserId={currentUserId}
            isParticipant={canPlay}
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
