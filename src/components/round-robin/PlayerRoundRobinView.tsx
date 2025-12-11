import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Clock, Trophy, Users } from "lucide-react";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { motion } from "framer-motion";
import { formatDateEST, formatTime12Hour } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PlayerRoundRobinViewProps {
  eventId: string;
  userId: string | null;
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
  status: "draft" | "live" | "completed";
  rating_eligible: boolean;
  rating_type: string;
}

interface Player {
  id: string;
  player_id: string;
  registration_status: string;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
  };
}

interface ScheduleMatch {
  id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  team_a_score: number | null;
  team_b_score: number | null;
  completed: boolean;
  is_bye: boolean;
}

interface StandingsRow {
  playerId: string;
  playerName: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
}

export function PlayerRoundRobinView({ eventId, userId }: PlayerRoundRobinViewProps) {
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          player_id,
          registration_status,
          profiles:player_id (
            id,
            full_name,
            display_name
          )
        `)
        .eq("event_id", eventId)
        .eq("active", true);

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Fetch schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", eventId)
        .order("round_no", { ascending: true })
        .order("court_no", { ascending: true });

      if (scheduleError) throw scheduleError;
      
      // Map the data to include all needed fields
      const mappedSchedule = (scheduleData || []).map(match => ({
        ...match,
        team_a_score: match.team1_score,
        team_b_score: match.team2_score,
        completed: !!match.team1_score && !!match.team2_score
      }));
      
      setSchedule(mappedSchedule);

      // Calculate standings
      if (mappedSchedule) {
        calculateStandings(mappedSchedule, playersData || []);
      }
    } catch (error) {
      console.error("Error fetching event data:", error);
      toast.error("Failed to load event details");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStandings = (matches: ScheduleMatch[], playersList: Player[]) => {
    const stats: Record<string, StandingsRow> = {};

    // Initialize stats for all players
    playersList.forEach((p) => {
      stats[p.player_id] = {
        playerId: p.player_id,
        playerName: p.profiles?.display_name || p.profiles?.full_name || "Unknown",
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        gamesPlayed: 0,
      };
    });

    // Calculate from completed matches
    matches.forEach((match) => {
      const teamAScore = match.team_a_score ?? match.team1_score ?? null;
      const teamBScore = match.team_b_score ?? match.team2_score ?? null;
      
      if (!match.completed || teamAScore === null || teamBScore === null) return;

      const teamAPlayers = [match.a1_player_id, match.a2_player_id].filter(Boolean) as string[];
      const teamBPlayers = [match.b1_player_id, match.b2_player_id].filter(Boolean) as string[];

      const teamAWon = teamAScore > teamBScore;

      teamAPlayers.forEach((playerId) => {
        if (stats[playerId]) {
          stats[playerId].gamesPlayed += 1;
          stats[playerId].pointsFor += teamAScore;
          stats[playerId].pointsAgainst += teamBScore;
          if (teamAWon) stats[playerId].wins += 1;
          else stats[playerId].losses += 1;
        }
      });

      teamBPlayers.forEach((playerId) => {
        if (stats[playerId]) {
          stats[playerId].gamesPlayed += 1;
          stats[playerId].pointsFor += teamBScore;
          stats[playerId].pointsAgainst += teamAScore;
          if (!teamAWon) stats[playerId].wins += 1;
          else stats[playerId].losses += 1;
        }
      });
    });

    const sortedStandings = Object.values(stats).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
    });

    setStandings(sortedStandings);
  };

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "BYE";
    const player = players.find((p) => p.player_id === playerId);
    return player?.profiles?.display_name || player?.profiles?.full_name || "Unknown";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-muted text-muted-foreground",
      live: "bg-primary text-primary-foreground",
      completed: "bg-secondary text-secondary-foreground",
    };
    return (
      <Badge className={styles[status as keyof typeof styles] || styles.draft}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const filteredPlayers = players.filter((p) =>
    (p.profiles?.display_name || p.profiles?.full_name || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const groupedSchedule = schedule.reduce((acc, match) => {
    if (!acc[match.round_no]) acc[match.round_no] = [];
    acc[match.round_no].push(match);
    return acc;
  }, {} as Record<number, ScheduleMatch[]>);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Event not found</p>
          <Button className="mt-4" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Standard PULSE Header */}
      <PageHeader userId={userId} />

      {/* Hero Banner with Event Info */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative border-b-2"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--accent)) 0%, hsl(var(--background)) 80%)',
          borderBottomColor: 'hsl(var(--primary) / 0.15)',
        }}
      >
        <div className="container mx-auto py-6 px-4 md:py-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Left: Title and details */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Trophy className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <h1 
                    className="text-3xl md:text-4xl lg:text-5xl font-bold border-l-4 pl-3 text-foreground"
                    style={{
                      borderLeftColor: 'hsl(var(--primary))',
                    }}
                  >
                    {event.name}
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="h-0.5 mt-1 origin-left bg-primary"
                    />
                  </h1>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-base md:text-lg text-muted-foreground pl-8">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateEST(event.date, "EEEE, MMMM d, yyyy")}</span>
                </div>
                {event.start_time && (
                  <>
                    <span>•</span>
                    <span>{formatTime12Hour(event.start_time)}</span>
                  </>
                )}
                {event.location && (
                  <>
                    <span>•</span>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location}</span>
                    </div>
                  </>
                )}
              </div>
              {event.notes && (
                <p className="text-sm text-muted-foreground pl-8 max-w-2xl">
                  {event.notes}
                </p>
              )}
              <div className="flex items-center gap-3 pl-8 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{players.length} players registered</span>
                <span>•</span>
                <span>Doubles Format</span>
              </div>
            </div>
            
            {/* Right: Status badge */}
            <div>
              {getStatusBadge(event.status)}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="schedule" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-4">
            {Object.keys(groupedSchedule).length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Schedule not yet generated</p>
                </CardContent>
              </Card>
            ) : (
              <ScheduleRoundCarousel
                totalRounds={Object.keys(groupedSchedule).length}
                currentRound={event.current_round || 1}
              >
                {(roundNo) => {
                  const matches = groupedSchedule[roundNo] || [];
                  
                  return (
                    <Card className={event.current_round === roundNo ? "border-primary" : ""}>
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span>Round {roundNo}</span>
                          {event.current_round === roundNo && (
                            <Badge variant="default">Current Round</Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {matches.map((match) => {
                            const isBye =
                              !match.a1_player_id ||
                              !match.b1_player_id ||
                              match.a1_player_id === match.b1_player_id;
                            const teamAScore = match.team_a_score ?? match.team1_score ?? null;
                            const teamBScore = match.team_b_score ?? match.team2_score ?? null;
                            const teamAWon = match.completed && teamAScore !== null && teamBScore !== null && teamAScore > teamBScore;
                            const teamBWon = match.completed && teamAScore !== null && teamBScore !== null && teamBScore > teamAScore;

                            return (
                              <div
                                key={match.id}
                                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Badge variant="outline" className="min-w-[60px] justify-center">
                                    Court {match.court_no}
                                  </Badge>
                                  {isBye ? (
                                    <div className="text-muted-foreground">
                                      <span className="font-medium">{getPlayerName(match.a1_player_id)}</span> - BYE
                                    </div>
                                  ) : (
                                    <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                                      <div className={`text-sm ${teamAWon ? "font-semibold" : ""}`}>
                                        {getPlayerName(match.a1_player_id)} / {getPlayerName(match.a2_player_id)}
                                      </div>
                                      <div className="text-center">
                                        {match.completed ? (
                                          <span className="font-mono font-semibold">
                                            {teamAScore} - {teamBScore}
                                          </span>
                                        ) : (
                                          <span className="text-muted-foreground">vs</span>
                                        )}
                                      </div>
                                      <div className={`text-sm text-right ${teamBWon ? "font-semibold" : ""}`}>
                                        {getPlayerName(match.b1_player_id)} / {getPlayerName(match.b2_player_id)}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
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
            <div className="flex gap-2">
              <Input
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlayers.map((player) => {
                const playerStats = standings.find((s) => s.playerId === player.player_id);
                return (
                  <Card key={player.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {getInitials(player.profiles?.display_name || player.profiles?.full_name || "?")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {player.profiles?.display_name || player.profiles?.full_name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {playerStats ? `${playerStats.gamesPlayed} games • ${playerStats.wins}-${playerStats.losses}` : "No games yet"}
                          </div>
                        </div>
                        {player.registration_status === "waitlisted" && (
                          <Badge variant="outline" className="text-xs">Waitlist</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Standings Tab */}
          <TabsContent value="standings">
            <Card>
              <CardHeader>
                <CardTitle>Event Standings</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Rank</TableHead>
                      <TableHead>Player</TableHead>
                      <TableHead className="text-center">W</TableHead>
                      <TableHead className="text-center">L</TableHead>
                      <TableHead className="text-center">PF</TableHead>
                      <TableHead className="text-center">PA</TableHead>
                      <TableHead className="text-center">Diff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {standings.map((row, index) => (
                      <TableRow key={row.playerId} className={row.playerId === userId ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>{row.playerName}</TableCell>
                        <TableCell className="text-center">{row.wins}</TableCell>
                        <TableCell className="text-center">{row.losses}</TableCell>
                        <TableCell className="text-center">{row.pointsFor}</TableCell>
                        <TableCell className="text-center">{row.pointsAgainst}</TableCell>
                        <TableCell className="text-center">{row.pointsFor - row.pointsAgainst}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
