import { useNavigate, useParams, useLocation } from "react-router-dom";

import { ActionButton } from "@/components/leagues/ActionButton";
import {
  ArrowLeft,
  Trophy,
  CalendarDays,
  Users,
  CalendarClock,
  Swords,
  Settings,
  Gauge,
  ChevronRight,
  Info,
  MapPin,
  ArrowUpRight,
  Activity,
} from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";
import { supabase } from "@/integrations/supabase/client";
import type { LeagueMatchStatus } from "@/lib/leagues/types";
import { useLeagueDetailForPlayer } from "@/hooks/useLeagueDetailForPlayer";
import { sideName } from "@/lib/leagues/matchSides";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { LeaguePlayerName } from "@/components/leagues/LeaguePlayerName";
import { LeagueScorecard } from "@/components/leagues/LeagueScorecard";
import {
  leaguePlayerName,
  substitutePlayerIds,
  matchPlayerLabel,
} from "@/lib/leagues/playerIdentity";
import type { LeagueMatchSubstitution } from "@/lib/leagues/types";
import {
  computePlayerStandings,
  computeTeamStandings,
} from "@/lib/leagues/standings";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { LadderSubRequestCard } from "@/components/leagues/LadderSubRequestCard";
import { LadderMyWeekCard } from "@/components/leagues/LadderMyWeekCard";
import { LadderHowItWorks } from "@/components/leagues/LadderHowItWorks";
import { LeagueMatchActions } from "@/components/leagues/LeagueMatchActions";
import { LadderTiebreakPrompt } from "@/components/leagues/LadderTiebreakPrompt";
import {
  LeagueScope,
  LeagueTypeChip,
  LeagueStatusPill,
  LgSectionHeader,
  LeaguePageSkeleton,
} from "@/components/leagues/_leagueScope";
import { cn } from "@/lib/utils";
import { SeasonSelect } from "@/components/admin/leagues/_shared";
import { leagueErrorMessage } from "@/lib/leagues/data";
import {
  PlayerLeagueStage,
  LeagueDateTile,
  leagueSessionTime,
} from "@/components/leagues/PlayerLeagueStage";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { playerLeagueTabFromHash } from "@/lib/leagues/playerNavigation";
import { needsMatchAction } from "@/lib/leagues/operations";

const MATCH_STATUS_TONE: Record<LeagueMatchStatus, string> = {
  scheduled: "bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text-dim)]",
  in_progress:
    "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  score_submitted:
    "bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)]",
  verified:
    "bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)]",
  disputed: "bg-destructive/20 text-destructive",
  canceled: "bg-muted text-muted-foreground",
  forfeit: "bg-muted text-muted-foreground",
};

// Plain-language labels so players don't see raw enum strings like
// "score_submitted". The badge tone above already colors the state.
const MATCH_STATUS_LABEL: Record<LeagueMatchStatus, string> = {
  scheduled: "Scheduled",
  in_progress: "In progress",
  score_submitted: "Awaiting confirm",
  verified: "Final",
  disputed: "Disputed",
  canceled: "Canceled",
  forfeit: "Forfeit",
};

export default function PlayerLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const requestedTab = playerLeagueTabFromHash(location.hash);
  const detail = useLeagueDetailForPlayer(leagueId);
  const {
    league,
    membership,
    season,
    matches,
    allMatches,
    allTeams,
    teamsById,
    playersById,
    teammates,
    matchSubs,
    myTeams,
    loading,
    currentUserId,
    refresh,
    error,
    canManage,
    seasons,
    setSeasonId,
    sessions,
    isActiveParticipant,
  } = detail;

  const isTeamMode =
    league?.league_type === "doubles" || league?.league_type === "team";

  // Fetch manager display name for the hero.
  const [managerName, setManagerName] = useState<string | null>(null);
  useEffect(() => {
    let canceled = false;
    setManagerName(null);
    if (!league?.created_by) return;
    (async () => {
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("display_name, full_name, first_name, last_name")
        .eq("id", league.created_by)
        .maybeSingle();
      if (data && !canceled) {
        const p = data as {
          display_name?: string | null;
          full_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
        };
        setManagerName(
          p.display_name ||
            p.full_name ||
            [p.first_name, p.last_name].filter(Boolean).join(" ") ||
            null
        );
      }
    })();
    return () => {
      canceled = true;
    };
  }, [league?.created_by]);

  const standings = useMemo(() => {
    if (!league) return [];
    if (isTeamMode) {
      return computeTeamStandings(allMatches, allTeams, {
        seasonId: season?.id ?? undefined,
      });
    }
    return computePlayerStandings(
      allMatches,
      (id) => (playersById[id] ? resolvePlayerName(playersById[id]) : "Player"),
      { seasonId: season?.id ?? undefined }
    );
  }, [allMatches, allTeams, playersById, season?.id, isTeamMode, league]);

  const myTeamIdSet = useMemo(
    () => new Set(myTeams.map((t) => t.id)),
    [myTeams]
  );
  const myRow = isTeamMode
    ? standings.find((r) => myTeamIdSet.has(r.teamId))
    : standings.find((r) => r.teamId === currentUserId);

  if (loading) {
    return <LeaguePageSkeleton />;
  }

  if (error) {
    return (
      <LeagueScope>
        <div
          className="mx-auto max-w-md p-6 text-center space-y-3"
          role="alert"
        >
          <h1 className="font-semibold">Couldn't load this league</h1>
          <p className="text-sm text-muted-foreground">
            {leagueErrorMessage(error)}
          </p>
          <ActionButton onClick={refresh}>Try again</ActionButton>
        </div>
      </LeagueScope>
    );
  }

  if (!league) {
    return (
      <LeagueScope>
        <div className="container mx-auto px-4 py-10 text-center max-w-md">
          <p className="text-sm font-medium text-[color:var(--lg-text)]">
            League not available
          </p>
          <p className="text-xs text-[color:var(--lg-text-dim)] mt-1">
            This league might have ended or your membership isn't active.
          </p>
          <ActionButton
            size="sm"
            variant="outline"
            className="group mt-4 border-[color:var(--lg-gold)]/50 text-[color:var(--lg-accent-gold)]"
            onClick={() => navigate("/player/leagues")}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5 motion-safe:transition-transform motion-safe:group-hover:-translate-x-0.5" />{" "}
            Back to my leagues
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

  const activeTab =
    requestedTab === "team" && !isTeamMode ? "info" : requestedTab;
  const publishedSessions = sessions
    .filter((s) => s.status === "published")
    .sort(
      (a, b) =>
        (a.scheduled_date ?? "9999").localeCompare(
          b.scheduled_date ?? "9999"
        ) || (a.start_time ?? "").localeCompare(b.start_time ?? "")
    );
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const seasonFinished =
    league.status === "archived" ||
    season?.status === "completed" ||
    season?.status === "archived";
  const nextSession =
    !seasonFinished &&
    publishedSessions.find(
      (s) => s.scheduled_date && s.scheduled_date >= today
    );
  const tabs = [
    { id: "gameday", label: "Game day", icon: Activity },
    { id: "standings", label: "Standings", icon: Trophy },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "results", label: "Results", icon: Swords },
    ...(isTeamMode ? [{ id: "team", label: "My team", icon: Users }] : []),
    { id: "info", label: "League info", icon: Info },
  ];
  const changeTab = (tab: string) =>
    navigate(
      { pathname: location.pathname, search: location.search, hash: `#${tab}` },
      { replace: true, preventScrollReset: true }
    );
  const renderMatches = (rows: typeof matches, allowPlay: boolean) => (
    <ul className="grid gap-4 xl:grid-cols-2">
      {rows.map((m) => (
        <MatchRow
          key={m.id}
          match={m}
          substitutions={matchSubs}
          teamsById={teamsById}
          playersById={playersById}
          currentUserId={currentUserId}
          canPlay={
            allowPlay &&
            isActiveParticipant &&
            league.status === "active" &&
            season?.status === "active" &&
            (!m.session_id ||
              sessions.some(
                (s) => s.id === m.session_id && s.status === "published"
              ))
          }
          isLadder={league.league_type === "ladder"}
          onChanged={refresh}
        />
      ))}
    </ul>
  );

  return (
    <LeagueScope brand={league.branding} className="league-player">
      <div className="container mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 sm:py-7">
        <div className="flex items-center justify-between gap-2">
          <ActionButton
            variant="ghost"
            size="sm"
            onClick={() => navigate("/player/leagues")}
            className="-ml-2 h-11 rounded-xl text-muted-foreground"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            My leagues
          </ActionButton>
          {canManage && (
            <ActionButton
              size="sm"
              variant="outline"
              onClick={() =>
                navigate(
                  `/player/leagues/${league.id}/manage${season ? `?season=${encodeURIComponent(season.id)}` : ""}`
                )
              }
              className="h-11 rounded-xl"
            >
              <Settings className="mr-1.5 h-4 w-4" />
              Manage league
            </ActionButton>
          )}
        </div>
        <PlayerLeagueStage
          compact
          title={league.name}
          branding={league.branding}
          showIdentity
          description={
            season?.name ?? "Your next chapter on court starts here."
          }
          eyebrow={
            <>
              <LeagueTypeChip type={league.league_type} onHero />
              <LeagueStatusPill status={league.status} onHero />
              {season && (
                <span className="rounded-full border border-white/20 px-3 py-1 capitalize">
                  {season.status} season
                </span>
              )}
            </>
          }
          stats={[
            { label: "Your record", value: record },
            { label: "Games played", value: myRow?.gamesPlayed ?? 0 },
            {
              label: "Win rate",
              value: myRow?.gamesPlayed
                ? `${Math.round((myRow.wins / myRow.gamesPlayed) * 100)}%`
                : "—",
            },
          ]}
        >
          {league.location && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#d4d5cf]">
              <MapPin className="h-4 w-4 shrink-0" />
              {league.location}
            </span>
          )}
          {managerName && (
            <span className="text-xs text-[#d4d5cf]">
              Organized by {managerName}
            </span>
          )}
        </PlayerLeagueStage>

        {seasons.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Your season, from first serve to final score.
            </p>
            <SeasonSelect
              seasons={seasons}
              value={season?.id ?? ""}
              onChange={setSeasonId}
              className="min-w-0 basis-full sm:basis-auto sm:max-w-sm"
            />
          </div>
        )}

        <Tabs value={activeTab} onValueChange={changeTab}>
          <div className="league-player-nav">
            <TabsList
              className="league-player-tabs"
              aria-label="League sections"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="league-player-tab"
                >
                  <tab.icon className="h-4 w-4" aria-hidden />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent
            value="gameday"
            className="league-player-panel space-y-5"
          >
            {nextSession && (
              <button
                className="group flex w-full items-center gap-4 rounded-2xl border border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] p-4 text-left transition-colors hover:border-[color:var(--lg-gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => changeTab("schedule")}
              >
                <LeagueDateTile date={nextSession.scheduled_date} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[10px] font-bold uppercase tracking-[.15em] text-[color:var(--lg-accent-gold)]">
                    Next on the calendar
                  </span>
                  <span className="mt-1 block break-words text-base font-semibold">
                    {nextSession.name}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {new Date(
                      `${nextSession.scheduled_date}T12:00:00`
                    ).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {leagueSessionTime(nextSession.start_time)}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-5 w-5 shrink-0 text-[color:var(--lg-accent-gold)]"
                  aria-hidden
                />
              </button>
            )}
            {league.league_type === "ladder" && (
              <LadderMyWeekCard
                dataVersion={detail.dataVersion}
                seasonId={season?.id ?? null}
                currentUserId={currentUserId}
              />
            )}
            {league.league_type === "ladder" && leagueId && (
              <LadderTiebreakPrompt
                leagueId={leagueId}
                playersById={playersById}
                onResolved={refresh}
              />
            )}
            <section id="upcoming" className="space-y-3">
              <LgSectionHeader
                icon={Swords}
                action={
                  <span className="text-xs text-muted-foreground">
                    {upcoming.length} to play or finish
                  </span>
                }
              >
                Your matchups
              </LgSectionHeader>
              {upcoming.length ? (
                renderMatches(upcoming, true)
              ) : (
                <LeaguePlayerEmpty
                  icon={CalendarClock}
                  title={
                    seasonFinished
                      ? "This season is complete"
                      : past.length
                        ? "You’re all caught up"
                        : "The first serve is coming"
                  }
                  description={
                    seasonFinished
                      ? "Revisit the season’s results and standings using the tabs above."
                      : season
                        ? "Your next matchups will appear here when your organizer publishes the draw."
                        : "Your organizer will open the season and schedule play here."
                  }
                />
              )}
            </section>
            {league.league_type === "ladder" && (
              <LadderSubRequestCard
                leagueId={league.id}
                seasonId={season?.id ?? null}
                currentUserId={currentUserId}
                canRequest={
                  membership?.status === "active" &&
                  membership?.season_id === season?.id &&
                  league.status === "active" &&
                  season?.status === "active"
                }
              />
            )}
          </TabsContent>

          <TabsContent value="standings" className="league-player-panel">
            <section id="standings" className="lg-card space-y-4 p-4 sm:p-6">
              <LgSectionHeader icon={Trophy}>
                The season standings
              </LgSectionHeader>
              <p className="text-sm text-muted-foreground">
                {league.league_type === "ladder"
                  ? "Your win–loss record across the season. Your current ladder position is on Game day."
                  : "See how the competition is shaping up."}{" "}
                Confirmed results only.
              </p>
              <StandingsTable
                substituteIds={
                  isTeamMode
                    ? undefined
                    : substitutePlayerIds(
                        allMatches.filter((m) => m.status === "verified"),
                        matchSubs
                      )
                }
                rows={standings}
                nameHeader={isTeamMode ? "Team" : "Player"}
                highlightTeamIds={
                  isTeamMode
                    ? myTeamIdSet
                    : currentUserId
                      ? new Set([currentUserId])
                      : undefined
                }
                emptyMessage={
                  seasonFinished
                    ? "No confirmed results were recorded for this season."
                    : "The standings start with the first confirmed result. Your season is just getting started."
                }
              />
            </section>
          </TabsContent>

          <TabsContent
            value="schedule"
            className="league-player-panel space-y-5"
          >
            <section
              aria-label="Season schedule"
              className="lg-card p-4 sm:p-6"
            >
              <LgSectionHeader icon={CalendarDays}>
                Make room for game day
              </LgSectionHeader>
              <p className="mb-5 text-sm text-muted-foreground">
                Your published season schedule. Check each session for its date,
                start time, and location.
              </p>
              {publishedSessions.length ? (
                <ol className="grid gap-3 sm:grid-cols-2">
                  {publishedSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex min-w-0 items-start gap-4 rounded-2xl border border-[color:var(--lg-border)] p-4"
                    >
                      <LeagueDateTile date={s.scheduled_date} />
                      <div className="min-w-0">
                        <h3 className="break-words text-sm font-semibold">
                          {s.name}
                        </h3>
                        <p className="mt-1 text-sm">
                          {s.scheduled_date
                            ? new Date(
                                `${s.scheduled_date}T12:00:00`
                              ).toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "Date to be announced"}
                        </p>
                        <p className="text-sm font-semibold text-[color:var(--lg-accent-gold)]">
                          {leagueSessionTime(s.start_time)}
                        </p>
                        {s.location && (
                          <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="break-words">{s.location}</span>
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <LeaguePlayerEmpty
                  icon={CalendarClock}
                  title={
                    seasonFinished
                      ? "No published schedule"
                      : "Your calendar is taking shape"
                  }
                  description={
                    seasonFinished
                      ? "No published sessions are recorded for this season."
                      : "Published sessions will appear here once your organizer schedules them."
                  }
                />
              )}
            </section>
          </TabsContent>

          <TabsContent
            value="results"
            className="league-player-panel space-y-4"
          >
            <section id="past" className="space-y-4">
              <LgSectionHeader icon={Swords}>Your results</LgSectionHeader>
              <p className="text-sm text-muted-foreground">
                Your match history, with the players and scores recorded for
                each game.
              </p>
              {past.length ? (
                renderMatches(past, false)
              ) : (
                <LeaguePlayerEmpty
                  icon={Trophy}
                  title={
                    seasonFinished
                      ? "No results for this season"
                      : "A season of results ahead"
                  }
                  description={
                    seasonFinished
                      ? "No finished matches are recorded for you in this season."
                      : "Your finished matches will be collected here."
                  }
                />
              )}
            </section>
          </TabsContent>

          {isTeamMode && (
            <TabsContent value="team" className="league-player-panel">
              {isTeamMode && teammates.length > 0 && (
                <div id="team" className="lg-card p-5 sm:p-6">
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
                          tm.is_me && "ring-1 ring-[color:var(--lg-gold)]/40"
                        )}
                      >
                        <div className="h-8 w-8 rounded-full bg-[color:var(--lg-emerald)]/25 text-[color:var(--lg-emerald-bright)] flex items-center justify-center text-xs font-bold shrink-0">
                          {tm.display_name.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold break-words text-[color:var(--lg-text)]">
                            <LeaguePlayerName
                              name={tm.display_name}
                              isSub={tm.role === "substitute"}
                            />
                            {tm.is_me && (
                              <span className="text-[color:var(--lg-text-dim)] font-normal">
                                {" "}
                                · you
                              </span>
                            )}
                          </div>
                          <div className="text-xs capitalize text-[color:var(--lg-text-dim)]">
                            {tm.is_captain ? "Captain" : tm.role}
                            {myTeams.length > 1 && ` · ${tm.team_name}`}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {!teammates.length && (
                <LeaguePlayerEmpty
                  icon={Users}
                  title={
                    seasonFinished
                      ? "No team roster recorded"
                      : "Your team is coming together"
                  }
                  description={
                    seasonFinished
                      ? "There is no team assignment for you in this season."
                      : "Your organizer will add your roster here."
                  }
                />
              )}
            </TabsContent>
          )}

          <TabsContent value="info" className="league-player-panel space-y-5">
            <section className="lg-card space-y-4 p-5 sm:p-6">
              <LgSectionHeader icon={Info}>Inside your league</LgSectionHeader>
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
                {league.description ||
                  "Your schedule, matchups, and season progress are all together here. Your organizer handles the format and weekly arrangements."}
              </p>
              <dl className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Organizer</dt>
                  <dd className="mt-1 break-words text-sm font-semibold">
                    {managerName ?? "Name unavailable"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Your role</dt>
                  <dd className="mt-1 text-sm font-semibold capitalize">
                    {canManage
                      ? "Organizer"
                      : (membership?.role ?? "Guest / substitute")}
                  </dd>
                </div>
                {league.location && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Location</dt>
                    <dd className="mt-1 break-words text-sm font-semibold">
                      {league.location}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">
                    PULSE ratings
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {league.rating_eligible
                      ? "Eligible confirmed matches count toward ratings"
                      : "League results only"}
                  </dd>
                </div>
              </dl>
            </section>
            {league.league_type === "ladder" && (
              <LadderHowItWorks defaultOpen />
            )}
            {isSkillAssessmentEnabled() && (
              <button
                type="button"
                onClick={() => navigate("/player/self-assessment")}
                className="lg-card flex w-full items-center gap-3 p-4 text-left"
              >
                <Gauge className="h-5 w-5 text-[color:var(--lg-accent-gold)]" />
                <span className="flex-1 text-sm font-semibold">
                  Rate your game with the PULSE Skill Assessment
                </span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </LeagueScope>
  );
}

function LeaguePlayerEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Trophy;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] px-5 py-10 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-[color:var(--lg-accent-gold)]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function MatchRow({
  match,
  teamsById,
  playersById,
  currentUserId,
  isLadder,
  canPlay,
  onChanged,
  substitutions,
}: {
  match: import("@/lib/leagues/types").LeagueMatch;
  substitutions: LeagueMatchSubstitution[];
  teamsById: Record<string, import("@/lib/leagues/types").LeagueTeam>;
  playersById: Record<
    string,
    {
      display_name: string | null;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }
  >;
  currentUserId: string | null;
  isLadder?: boolean;
  canPlay: boolean;
  onChanged: () => void;
}) {
  const teamA = match.team_a_id ? teamsById[match.team_a_id] : null;
  const teamB = match.team_b_id ? teamsById[match.team_b_id] : null;
  const nameOf = (id: string | null): string | null =>
    id
      ? matchPlayerLabel(
          match,
          id,
          leaguePlayerName(playersById[id]),
          substitutions
        )
      : null;
  const aName = sideName(teamA?.name ?? null, [
    nameOf(match.player_a_id),
    nameOf(match.player_b_id),
  ]);
  const bName = sideName(teamB?.name ?? null, [
    nameOf(match.player_c_id),
    nameOf(match.player_d_id),
  ]);

  return (
    <li className="league-match-card rounded-2xl border border-[color:var(--lg-border)] bg-[color:var(--lg-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/30 border-b border-[color:var(--lg-border)]">
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap text-xs text-[color:var(--lg-text-dim)]">
          <span
            className={cn(
              "font-semibold px-2 py-1 rounded-md",
              MATCH_STATUS_TONE[match.status]
            )}
          >
            {MATCH_STATUS_LABEL[match.status] ?? match.status.replace("_", " ")}
          </span>
          {match.scheduled_time && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              {new Date(match.scheduled_time).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          )}
          {match.court_number && <span>· Court {match.court_number}</span>}
        </div>
      </div>

      <LeagueScorecard
        match={match}
        nameOf={(id) => leaguePlayerName(playersById[id])}
        substitutions={substitutions}
        teamAName={teamA?.name}
        teamBName={teamB?.name}
      />

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
