import { scheduleMatchLabel } from "@/lib/roundRobin/scheduleDisplay";
import { resolvedMatchLabel } from "@/lib/roundRobin/standings";
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { RoundRobinButton as Button } from "@/components/round-robin/RoundRobinButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, ArrowLeft, Share2, RefreshCw } from "lucide-react";
import { shareRoundRobin } from "@/lib/roundRobin/sharing";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { TeamNamesStack } from "@/components/round-robin/TeamNamesStack";

import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { motion, MotionConfig } from "framer-motion";
import { EventTabs } from "./EventTabs";
import { RoundRobinHostHero } from "./RoundRobinHostHero";
import { PlayerEventBriefing } from "./PlayerEventBriefing";
import { playerRoundFocus } from "@/lib/roundRobin/playerRoundFocus";
import { buildPlayerEventSnapshot, type HydratedEventPlayer, type HydratedEventMatch } from "@/lib/roundRobin/playerEventSnapshot";
import { EventStandings } from "./EventStandings";
import { EventRoster } from "./EventRoster";
import { RoundScheduleSummary, RestingPlayers } from "./RoundScheduleSummary";

interface PlayerRoundRobinViewProps {
  event: Event;
  roster: HydratedEventPlayer[];
  rows: HydratedEventMatch[];
  userId: string | null;
  loadError?: string | null;
  refreshing: boolean;
  updatedAt: Date | null;
  onRefresh: () => void;
}

interface Event {
  id: string;
  name: string;
  date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  current_round: number | null;
  status: "draft" | "live" | "completed" | "voided";
  rating_eligible: boolean;
  rating_type: string;
  format?: string;
  allow_guests?: boolean;
  registration_mode?: string | null;
  invite_code?: string | null;
  voided?: boolean;
}

type ScheduleMatch = ReturnType<typeof buildPlayerEventSnapshot>['schedule'][number];

export function PlayerRoundRobinView({ event, roster, rows, userId, loadError, refreshing, updatedAt, onRefresh }: PlayerRoundRobinViewProps) {
  const navigate = useNavigate();
  const [playerSearch, setPlayerSearch] = useState("");
  const [activeView, setActiveView] = useState("court");
  const { players, byId, schedule, standings, groupedSchedule, roundNumbers } = useMemo(
    () => buildPlayerEventSnapshot(roster, rows), [roster, rows],
  );
  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "Awaiting player";
    // playerId may be either a profile uuid or a guest_player uuid.
    const player = byId.get(playerId);
    if (!player) return "Someone";
    if (player.profiles) {
      return player.profiles.display_name || player.profiles.full_name || "Someone";
    }
    const name = player.guest_display_name || "Guest";
    return player.guest_linked_user_id ? name : `${name} (G)`;
  };

  /** Resolve a seat's name regardless of whether it's a registered player or a guest. */
  const seatName = (match: ScheduleMatch, seat: 'a1' | 'a2' | 'b1' | 'b2') =>
    getPlayerName(match[`${seat}_player_id`] ?? match[`${seat}_guest_id`] ?? null);

  const myIds = new Set(userId ? [userId, ...players.filter(p => p.guest_linked_user_id === userId).map(p => p.player_id)] : []);
  const { current: myMatch, next: nextMatch, onTeamA, resting } = playerRoundFocus(schedule, myIds, event.current_round || 1);
  const myStats = standings.find(row => myIds.has(row.playerId));

  return (
    <MotionConfig reducedMotion="user">
    <div className="rr-event-page rr-player-page">
      {/* PULSE Player Header — matches the sticky top bar used across player pages */}
      <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
        <div className="rr-event-width rr-player-topbar flex items-center justify-between h-[64px] sm:h-[72px]">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-secondary-foreground hover:bg-secondary-foreground/10 -ml-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NavLink
              to="/player/dashboard"
              className="text-secondary-foreground hover:opacity-90 transition-opacity"
              aria-label="Go to dashboard"
            >
              <Logo className="h-[52px] sm:h-[65px] w-auto" />
            </NavLink>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" aria-label="Share Event" className="text-secondary-foreground hover:bg-secondary-foreground/10" onClick={async () => {
              try {
                if (await shareRoundRobin(event.id, event.name, event.registration_mode !== "open_registration" ? event.invite_code : null) === "copied") toast.success("Event link copied");
              } catch { toast.error("Could not share the link. Please try again."); }
            }}><Share2 className="h-5 w-5" /></Button>
            <ThemeToggle />
            {userId && <NotificationBell unreadCount={0} onOpen={() => navigate('/player/dashboard')} />}
          </div>
        </div>
      </header>


      <RoundRobinHostHero
        compact
        className="rr-player-identity"
        name={event.name} date={event.date} startTime={event.start_time} status={event.status}
        voided={event.voided} ratingEligible={event.rating_eligible} allowGuests={event.allow_guests}
        format={event.format} numRounds={event.num_rounds} numCourts={event.num_courts}
        playerCount={players.filter(p => p.rosterStatus === "active").length} hasSchedule={schedule.length > 0}
        eventId={event.id} location={event.location}
      />

      {/* Main Content Area */}
      <main className="rr-event-width rr-event-main rr-player-main" aria-label="Player event view">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26 }}
          className="rr-host-workspace rr-player-workspace"
        >
          <Tabs value={activeView} onValueChange={setActiveView} className="rr-player-view-tabs">
            <div className="flex shrink-0 items-center justify-between gap-3 pb-2">
              <div className="min-w-0 text-xs text-muted-foreground">
                <p>{loadError ? "Unable to update" : "Updates automatically"}</p>
                {updatedAt && <p className="mt-0.5 text-[11px]">Last checked <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></p>}
              </div>
              <Button variant="outline" size="sm" className="min-h-11 shrink-0 gap-2" busy={refreshing} onClick={onRefresh} aria-label="Refresh scores and court assignments">
                <RefreshCw aria-hidden="true" className={`h-4 w-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />
                {refreshing ? "Updating…" : "Refresh"}
              </Button>
            </div>
            {loadError && <div role="alert" className="mb-2 shrink-0 rounded-xl border border-destructive/30 p-3 text-sm">Could not update. Showing the last saved scores and assignments. <button className="min-h-11 px-2 font-semibold underline disabled:opacity-50" disabled={refreshing} onClick={onRefresh}>Retry</button></div>}
            <EventTabs playerHome playerCount={players.filter(p => p.rosterStatus === "active").length} />

            <TabsContent value="court" className="rr-courtside-panel">
              <PlayerEventBriefing status={event.voided ? "voided" : event.status} round={event.current_round || 1} totalRounds={event.num_rounds}
                court={myMatch && !resting ? myMatch.court_no : undefined} resting={resting}
                completedMatch={myMatch?.completed} wins={myStats?.wins} gamesPlayed={myStats?.gamesPlayed}
                resolvedLabel={myMatch ? resolvedMatchLabel(myMatch) : null}
                team={myMatch ? (onTeamA ? [seatName(myMatch, 'a1'), seatName(myMatch, 'a2')] : [seatName(myMatch, 'b1'), seatName(myMatch, 'b2')]) : undefined}
                opponents={myMatch ? (onTeamA ? [seatName(myMatch, 'b1'), seatName(myMatch, 'b2')] : [seatName(myMatch, 'a1'), seatName(myMatch, 'a2')]) : undefined}
                score={myMatch ? (onTeamA ? [myMatch.team_a_score, myMatch.team_b_score] : [myMatch.team_b_score, myMatch.team_a_score]) : undefined}
                next={nextMatch ? { round: nextMatch.round_no, court: nextMatch.court_no } : undefined}
                onExplore={setActiveView}
              />
              {event.notes && <details className="rr-host-note"><summary>From your host</summary><p>{event.notes}</p></details>}
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4">
              {Object.keys(groupedSchedule).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-12 text-center">
                    <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                      <Calendar className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Schedule not yet generated</h3>
                    <p className="text-muted-foreground">The organizer will generate the schedule soon.</p>
                  </CardContent>
                </Card>
              ) : (
                <ScheduleRoundCarousel
                  totalRounds={roundNumbers.length}
                  roundNumbers={roundNumbers}
                  currentRound={event.current_round || 1}
                  liveRound={event.status === 'live' && !event.voided ? event.current_round || 1 : undefined}
                >
                  {(roundNo) => {
                    const matches = groupedSchedule[roundNo] || [];
                    const isCurrentRound = (event.current_round || 1) === roundNo;
                    
                    return (
                      <Card className={`transition-all duration-300 ${isCurrentRound ? "border-primary shadow-[0_0_20px_hsl(var(--primary)/0.15)]" : "border-border/50"}`}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center justify-between">
                            <span className="text-xl">Round {roundNo}</span>
                            {isCurrentRound && event.status === "live" && (
                              <Badge className="bg-primary text-primary-foreground shadow-[0_0_8px_hsl(var(--primary)/0.4)]">
                                Current Round
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <RoundScheduleSummary matches={matches} round={roundNo} currentRound={event.current_round || 1} status={event.voided ? "voided" : event.status} />
                          <div className="rr-court-grid">
                            {matches.filter(match => !match.is_bye).map((match, idx) => {
                              const teamAScore = match.abandoned ? null : match.team_a_score ?? match.team1_score ?? null;
                              const teamBScore = match.abandoned ? null : match.team_b_score ?? match.team2_score ?? null;
                              const teamAWon = match.completed && teamAScore !== null && teamBScore !== null && teamAScore > teamBScore;
                              const teamBWon = match.completed && teamAScore !== null && teamBScore !== null && teamBScore > teamAScore;

                              return (
                                <motion.div
                                  key={match.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: Math.min(idx * 0.03, 0.15) }}
                                  className={`p-4 rounded-xl border transition-all ${match.id === myMatch?.id ? "rr-your-match" : ""} ${
                                    match.completed 
                                      ? "bg-gradient-to-r from-card to-muted/30 border-border" 
                                      : "bg-card border-border/50 hover:border-border"
                                  }`}
                                >
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <Badge
                                          variant="outline"
                                          className="justify-center font-mono text-[11px] bg-muted/50"
                                        >
                                          Court {match.court_no}
                                        </Badge>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {scheduleMatchLabel(match, roundNo, event.current_round || 1, event.voided ? "voided" : event.status)}
                                        </span>
                                      </div>

                                      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${teamAWon ? "bg-primary/10 border border-primary/25" : "bg-muted/40"}`}>
                                        <TeamNamesStack
                                          className="flex-1"
                                          isWinner={teamAWon}
                                          player1={seatName(match, 'a1')}
                                          player2={seatName(match, 'a2')}
                                        />
                                        <span className={`text-lg font-mono font-bold tabular-nums flex-shrink-0 ${teamAWon ? "text-primary" : "text-muted-foreground"}`}>
                                          {teamAScore ?? "–"}
                                        </span>
                                      </div>

                                      <div className={`flex items-center gap-2 rounded-lg px-2.5 py-2 ${teamBWon ? "bg-primary/10 border border-primary/25" : "bg-muted/40"}`}>
                                        <TeamNamesStack
                                          className="flex-1"
                                          isWinner={teamBWon}
                                          player1={seatName(match, 'b1')}
                                          player2={seatName(match, 'b2')}
                                        />
                                        <span className={`text-lg font-mono font-bold tabular-nums flex-shrink-0 ${teamBWon ? "text-primary" : "text-muted-foreground"}`}>
                                          {teamBScore ?? "–"}
                                        </span>
                                      </div>
                                    </div>
                                </motion.div>
                              );
                            })}
                          </div>
                          <RestingPlayers matches={matches} seatName={seatName} />
                        </CardContent>
                      </Card>
                    );
                  }}
                </ScheduleRoundCarousel>
              )}
            </TabsContent>

            <TabsContent value="players">
              <EventRoster players={players} standings={standings} myIds={myIds} searchTerm={playerSearch} onSearchTermChange={setPlayerSearch} />
            </TabsContent>
            <TabsContent value="standings">
              <EventStandings rows={standings} completed={event.status === 'completed'} voided={event.voided || event.status === 'voided'} myIds={myIds} />
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
    </MotionConfig>
  );
}
