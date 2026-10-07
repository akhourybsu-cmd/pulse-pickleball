import { resolvedMatchLabel } from "@/lib/roundRobin/standings";
import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { RoundRobinButton as Button } from "@/components/round-robin/RoundRobinButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Calendar, Trophy, Search, Medal, Target, TrendingUp, Star, ArrowLeft, Share2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlayerRoundRobinViewProps {
  event: Event;
  roster: HydratedEventPlayer[];
  rows: HydratedEventMatch[];
  userId: string | null;
  loadError?: string | null;
  onRetry: () => void;
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

export function PlayerRoundRobinView({ event, roster, rows, userId, loadError, onRetry }: PlayerRoundRobinViewProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("court");
  const { players, byId, schedule, standings, groupedSchedule } = useMemo(
    () => buildPlayerEventSnapshot(roster, rows), [roster, rows],
  );
  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "BYE";
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

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredPlayers = players.filter((p) =>
    (p.profiles?.display_name || p.profiles?.full_name || p.guest_display_name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

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
        playerCount={players.filter(p => p.registration_status).length} hasSchedule={schedule.length > 0}
        eventId={event.id} location={event.location}
      />

      {/* Main Content Area */}
      <main className="rr-event-width rr-event-main rr-player-main" aria-label="Player event view">
        {loadError && <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 p-3 text-sm">{loadError}<Button size="sm" variant="outline" onClick={onRetry}>Retry</Button></div>}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.26 }}
          className="rr-host-workspace rr-player-workspace"
        >
          <Tabs value={activeView} onValueChange={setActiveView} className="rr-player-view-tabs">
            <EventTabs playerHome playerCount={players.filter(p => p.registration_status).length} />

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
                  totalRounds={Object.keys(groupedSchedule).length}
                  currentRound={event.current_round || 1}
                >
                  {(roundNo) => {
                    const matches = groupedSchedule[roundNo] || [];
                    const isCurrentRound = event.current_round === roundNo;
                    
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
                        <CardContent>
                          <div className="rr-court-grid">
                            {matches.map((match, idx) => {
                              const a1Id = match.a1_player_id ?? match.a1_guest_id;
                              const b1Id = match.b1_player_id ?? match.b1_guest_id;
                              const isBye = !a1Id || !b1Id || a1Id === b1Id;
                              const teamAScore = match.abandoned ? null : match.team_a_score ?? match.team1_score ?? null;
                              const teamBScore = match.abandoned ? null : match.team_b_score ?? match.team2_score ?? null;
                              const teamAWon = match.completed && teamAScore !== null && teamBScore !== null && teamAScore > teamBScore;
                              const teamBWon = match.completed && teamAScore !== null && teamBScore !== null && teamBScore > teamAScore;

                              return (
                                <motion.div
                                  key={match.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className={`p-4 rounded-xl border transition-all ${match.id === myMatch?.id ? "rr-your-match" : ""} ${
                                    match.completed 
                                      ? "bg-gradient-to-r from-card to-muted/30 border-border" 
                                      : "bg-card border-border/50 hover:border-border"
                                  }`}
                                >
                                  {isBye ? (
                                    <div className="flex items-center gap-3">
                                      <Badge
                                        variant="outline"
                                        className="min-w-[62px] justify-center font-mono text-[11px] bg-muted/50"
                                      >
                                        Bye
                                      </Badge>
                                      <div className="text-sm text-muted-foreground min-w-0 truncate">
                                        <span className="font-medium text-foreground">{seatName(match, 'a1')}</span> — resting
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <Badge
                                          variant="outline"
                                          className="justify-center font-mono text-[11px] bg-muted/50"
                                        >
                                          Court {match.court_no}
                                        </Badge>
                                        {!match.completed && (
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                            {resolvedMatchLabel(match) ?? (event.status === "completed" || event.status === "voided" ? "No result" : isCurrentRound && event.status === "live" ? "On court" : "Upcoming")}
                                          </span>
                                        )}
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
                                  )}

                                </motion.div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }}
                </ScheduleRoundCarousel>
              )}
            </TabsContent>

            {/* Players Tab */}
            <TabsContent value="players" className="space-y-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-card/80 backdrop-blur-sm border-border/50 focus:border-primary focus:ring-primary/20"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPlayers.map((player, idx) => {
                  const playerStats = standings.find((s) => s.playerId === player.player_id);
                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card className="group hover:shadow-md hover:border-primary/40 transition-all duration-300">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all">
                              {player.profiles?.avatar_url && (
                                <AvatarImage src={player.profiles.avatar_url} alt={player.profiles?.display_name || player.profiles?.full_name || "Player"} />
                              )}
                              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary/20 text-foreground font-semibold">
                                {getInitials(player.profiles?.display_name || player.profiles?.full_name || player.guest_display_name || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate flex items-center gap-2">
                                <span className="truncate">
                                  {player.profiles?.display_name || player.profiles?.full_name || player.guest_display_name || "Player"}
                                </span>
                                {player.is_guest && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Guest</Badge>
                                )}
                                {player.player_id === userId && !player.is_guest && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/40 text-primary">You</Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                {player.profiles?.current_rating != null && (
                                  <span className="inline-flex items-center gap-1 text-foreground/80">
                                    <Star className="h-3 w-3 text-primary fill-primary" />
                                    {Number(player.profiles.current_rating).toFixed(2)}
                                  </span>
                                )}
                                {playerStats && playerStats.gamesPlayed > 0 ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-primary font-medium">{playerStats.wins}W</span>
                                    <span className="text-muted-foreground/60">·</span>
                                    <span className="text-destructive font-medium">{playerStats.losses}L</span>
                                  </span>
                                ) : (
                                  <span className="text-xs">No games yet</span>
                                )}
                              </div>
                            </div>
                            {!player.active && <Badge variant="outline" className="text-xs">Removed</Badge>}
                            {player.registration_status === "waitlisted" && (
                              <Badge variant="outline" className="text-xs">Waitlist</Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
              {filteredPlayers.length === 0 && (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center text-muted-foreground">
                    {searchTerm ? "No players match your search." : "No players registered yet."}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Standings Tab */}
            <TabsContent value="standings">
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-card to-muted/30 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Event Standings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table className="rr-event-table">
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableHead className="w-16 text-center font-semibold">Rank</TableHead>
                        <TableHead className="font-semibold">Player</TableHead>
                        <TableHead className="text-center font-semibold">
                          <span className="text-primary">W</span>
                        </TableHead>
                        <TableHead className="text-center font-semibold">
                          <span className="text-destructive">L</span>
                        </TableHead>
                        <TableHead className="hidden sm:table-cell text-center font-semibold">PF</TableHead>
                        <TableHead className="hidden sm:table-cell text-center font-semibold">PA</TableHead>
                        <TableHead className="text-center font-semibold">+/-</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {standings.map((row, index) => {
                        const isCurrentUser = row.playerId === userId;
                        const isTopThree = index < 3;
                        const diff = row.pointsFor - row.pointsAgainst;
                        
                        return (
                          <TableRow 
                            key={row.playerId} 
                            className={`transition-colors ${
                              isCurrentUser 
                                ? "bg-primary/10 hover:bg-primary/15" 
                                : isTopThree 
                                ? "bg-secondary/5 hover:bg-secondary/10" 
                                : ""
                            }`}
                          >
                            <TableCell className="text-center">
                              {index === 0 ? (
                                <Medal className="h-5 w-5 text-yellow-500 mx-auto" />
                              ) : index === 1 ? (
                                <Medal className="h-5 w-5 text-gray-400 mx-auto" />
                              ) : index === 2 ? (
                                <Medal className="h-5 w-5 text-amber-700 mx-auto" />
                              ) : (
                                <span className="font-medium text-muted-foreground">{index + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.playerName}
                              {isCurrentUser && (
                                <Badge variant="outline" className="ml-2 text-xs">You</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-semibold text-primary">{row.wins}</TableCell>
                            <TableCell className="text-center font-semibold text-destructive">{row.losses}</TableCell>
                            <TableCell className="hidden sm:table-cell text-center text-muted-foreground">{row.pointsFor}</TableCell>
                            <TableCell className="hidden sm:table-cell text-center text-muted-foreground">{row.pointsAgainst}</TableCell>
                            <TableCell className={`text-center font-semibold ${diff > 0 ? "text-primary" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                              {diff > 0 ? "+" : ""}{diff}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>
    </div>
    </MotionConfig>
  );
}
