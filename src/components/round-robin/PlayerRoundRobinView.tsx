import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Calendar, MapPin, Clock, Trophy, Users, Search, Medal, Target, TrendingUp, Star, ArrowLeft } from "lucide-react";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { toast } from "sonner";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
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
  status: "draft" | "live" | "completed" | "voided";
  rating_eligible: boolean;
  rating_type: string;
}

interface Player {
  id: string;
  player_id: string;
  registration_status: string;
  is_guest?: boolean;
  guest_display_name?: string | null;
  profiles: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    current_rating: number | null;
  } | null;
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

      // Fetch players (no active filter — names must resolve even for removed players)
      const { data: playersRaw, error: playersError } = await supabase
        .from("round_robin_players")
        .select("id, player_id, guest_player_id, guest_name, registration_status, active")
        .eq("event_id", eventId);

      if (playersError) throw playersError;

      // Fetch schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", eventId)
        .order("round_no", { ascending: true })
        .order("court_no", { ascending: true });

      if (scheduleError) throw scheduleError;

      // Collect referenced user-IDs and guest-IDs from roster + schedule
      const userIdSet = new Set<string>();
      const guestIdSet = new Set<string>();
      (playersRaw || []).forEach((p: any) => {
        if (p.player_id) userIdSet.add(p.player_id);
        if (p.guest_player_id) guestIdSet.add(p.guest_player_id);
      });
      (scheduleData || []).forEach((m) => {
        [m.a1_player_id, m.a2_player_id, m.b1_player_id, m.b2_player_id].forEach((id) => {
          if (!id) return;
          // We don't know whether this id is a user or guest; query both.
          userIdSet.add(id);
          guestIdSet.add(id);
        });
      });

      // Batch fetch profiles
      let profilesById = new Map<string, Player["profiles"]>();
      if (userIdSet.size > 0) {
        const { data: profilesData } = await supabase
          .from("profiles_public")
          .select("id, display_name, full_name, avatar_url, current_rating")
          .in("id", Array.from(userIdSet));
        profilesById = new Map(
          (profilesData || []).map((p) => [p.id, p as Player["profiles"]])
        );
      }

      // Batch fetch guests
      let guestsById = new Map<string, { id: string; display_name: string | null }>();
      if (guestIdSet.size > 0) {
        const { data: guestsData } = await supabase
          .from("guest_players")
          .select("id, display_name")
          .in("id", Array.from(guestIdSet));
        guestsById = new Map((guestsData || []).map((g: any) => [g.id, g]));
      }

      // Active registrations (Players tab)
      const activePlayersWithProfiles: Player[] = (playersRaw || [])
        .filter((p: any) => p.active !== false)
        .map((p: any) => {
          const isGuest = !!p.guest_player_id;
          const lookupId = p.player_id || p.guest_player_id;
          return {
            id: p.id,
            player_id: lookupId,
            registration_status: p.registration_status,
            is_guest: isGuest,
            guest_display_name: isGuest
              ? guestsById.get(p.guest_player_id)?.display_name || p.guest_name || "Guest"
              : null,
            profiles: isGuest ? null : profilesById.get(p.player_id) ?? null,
          };
        });

      // Lookup roster (every id seen in schedule)
      const allIds = new Set<string>([...userIdSet, ...guestIdSet]);
      const lookupPlayers: Player[] = Array.from(allIds).map((pid) => {
        const guest = guestsById.get(pid);
        const profile = profilesById.get(pid);
        return {
          id: pid,
          player_id: pid,
          registration_status: "",
          is_guest: !profile && !!guest,
          guest_display_name: guest?.display_name ?? null,
          profiles: profile ?? null,
        };
      });

      setPlayers([
        ...activePlayersWithProfiles,
        ...lookupPlayers.filter(
          (lp) => !activePlayersWithProfiles.some((ap) => ap.player_id === lp.player_id)
        ),
      ]);

      // Map schedule
      const mappedSchedule = (scheduleData || []).map((match) => ({
        ...match,
        team_a_score: match.team1_score,
        team_b_score: match.team2_score,
        completed: !!match.team1_score && !!match.team2_score,
      }));

      setSchedule(mappedSchedule);

      // Standings roster covers every id with a name fallback
      const standingsRoster: Player[] = Array.from(allIds).map((pid) => {
        const reg = (playersRaw || []).find((p: any) => p.player_id === pid || p.guest_player_id === pid);
        const guest = guestsById.get(pid);
        const profile = profilesById.get(pid);
        return {
          id: reg?.id ?? pid,
          player_id: pid,
          registration_status: reg?.registration_status ?? "",
          is_guest: !profile && !!guest,
          guest_display_name: guest?.display_name ?? (reg as any)?.guest_name ?? null,
          profiles: profile ?? null,
        };
      });
      calculateStandings(mappedSchedule, standingsRoster);
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
        playerName:
          p.profiles?.display_name ||
          p.profiles?.full_name ||
          (p.is_guest ? `${p.guest_display_name || "Guest"} (Guest)` : "Someone"),
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
    if (status === "live") {
      return (
        <Badge className="bg-primary text-primary-foreground shadow-[0_0_12px_rgba(197,232,108,0.5)] animate-pulse">
          <span className="mr-2 relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          LIVE
        </Badge>
      );
    }
    if (status === "completed") {
      return (
        <Badge className="bg-secondary text-secondary-foreground">
          <Trophy className="h-3 w-3 mr-1" />
          COMPLETED
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        DRAFT
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
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative h-16 w-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground font-medium">Loading event...</p>
        </motion.div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">Event not found</p>
          <Button onClick={() => navigate(-1)} variant="outline">
            Go Back
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* PULSE Player Header — matches the sticky top bar used across player pages */}
      <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between h-[64px] sm:h-[72px]">
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
            <ThemeToggle />
            {userId && <NotificationBell unreadCount={0} onOpen={() => navigate('/player/dashboard')} />}
          </div>
        </div>
      </header>


      {/* Premium Hero Banner */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden border-b border-border/50"
      >
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-secondary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="container relative mx-auto py-8 px-4 md:py-12">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left: Title and details */}
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4 flex-1"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
                    {event.name}
                  </h1>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="h-1 w-24 mt-2 origin-left bg-gradient-to-r from-primary to-primary/50 rounded-full"
                  />
                </div>
              </div>

              {/* Info pills */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>{formatDateEST(event.date, "EEEE, MMMM d, yyyy")}</span>
                </div>
                {event.start_time && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span>{formatTime12Hour(event.start_time)}</span>
                  </div>
                )}
                {event.location && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>

              {event.notes && (
                <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
                  {event.notes}
                </p>
              )}

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="font-medium text-foreground">{players.length}</span> players
                </div>
                <div className="h-4 w-px bg-border" />
                <span className="text-muted-foreground">Doubles Format</span>
              </div>
            </motion.div>
            
            {/* Right: Status badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {getStatusBadge(event.status)}
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Main Content Area */}
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs defaultValue="schedule" className="space-y-6">
            {/* Premium Tab List */}
            <TabsList className="w-full max-w-md mx-auto grid grid-cols-3 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm">
              <TabsTrigger 
                value="schedule" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </TabsTrigger>
              <TabsTrigger 
                value="players"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Users className="h-4 w-4 mr-2" />
                Players
              </TabsTrigger>
              <TabsTrigger 
                value="standings"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Standings
              </TabsTrigger>
            </TabsList>

            {/* Schedule Tab */}
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
                      <Card className={`transition-all duration-300 ${isCurrentRound ? "border-primary shadow-[0_0_20px_rgba(197,232,108,0.15)]" : "border-border/50"}`}>
                        <CardHeader className="pb-4">
                          <CardTitle className="flex items-center justify-between">
                            <span className="text-xl">Round {roundNo}</span>
                            {isCurrentRound && event.status === "live" && (
                              <Badge className="bg-primary text-primary-foreground shadow-[0_0_8px_rgba(197,232,108,0.4)]">
                                Current Round
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            {matches.map((match, idx) => {
                              const isBye =
                                !match.a1_player_id ||
                                !match.b1_player_id ||
                                match.a1_player_id === match.b1_player_id;
                              const teamAScore = match.team_a_score ?? match.team1_score ?? null;
                              const teamBScore = match.team_b_score ?? match.team2_score ?? null;
                              const teamAWon = match.completed && teamAScore !== null && teamBScore !== null && teamAScore > teamBScore;
                              const teamBWon = match.completed && teamAScore !== null && teamBScore !== null && teamBScore > teamAScore;

                              return (
                                <motion.div
                                  key={match.id}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  className={`p-4 rounded-xl border transition-all ${
                                    match.completed 
                                      ? "bg-gradient-to-r from-card to-muted/30 border-border" 
                                      : "bg-card border-border/50 hover:border-border"
                                  }`}
                                >
                                  <div className="flex items-center gap-4">
                                    <Badge 
                                      variant="outline" 
                                      className="min-w-[70px] justify-center font-mono text-xs bg-muted/50"
                                    >
                                      Court {match.court_no}
                                    </Badge>
                                    
                                    {isBye ? (
                                      <div className="text-muted-foreground italic">
                                        <span className="font-medium text-foreground">{getPlayerName(match.a1_player_id)}</span> — BYE
                                      </div>
                                    ) : (
                                      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
                                        <div className={`text-sm ${teamAWon ? "font-semibold text-primary" : ""}`}>
                                          {getPlayerName(match.a1_player_id)} / {getPlayerName(match.a2_player_id)}
                                        </div>
                                        <div className="text-center">
                                          {match.completed ? (
                                            <div className="flex items-center gap-2">
                                              <span className={`text-lg font-mono font-bold ${teamAWon ? "text-primary" : "text-muted-foreground"}`}>
                                                {teamAScore}
                                              </span>
                                              <span className="text-muted-foreground">-</span>
                                              <span className={`text-lg font-mono font-bold ${teamBWon ? "text-primary" : "text-muted-foreground"}`}>
                                                {teamBScore}
                                              </span>
                                            </div>
                                          ) : (
                                            <span className="text-muted-foreground text-sm">vs</span>
                                          )}
                                        </div>
                                        <div className={`text-sm text-right ${teamBWon ? "font-semibold text-primary" : ""}`}>
                                          {getPlayerName(match.b1_player_id)} / {getPlayerName(match.b2_player_id)}
                                        </div>
                                      </div>
                                    )}
                                  </div>
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
                                {getInitials(player.profiles?.display_name || player.profiles?.full_name || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate flex items-center gap-2">
                                <span className="truncate">
                                  {player.profiles?.display_name || player.profiles?.full_name || "Player"}
                                </span>
                                {player.player_id === userId && (
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
                  <Table>
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
                        <TableHead className="text-center font-semibold">PF</TableHead>
                        <TableHead className="text-center font-semibold">PA</TableHead>
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
                            <TableCell className="text-center text-muted-foreground">{row.pointsFor}</TableCell>
                            <TableCell className="text-center text-muted-foreground">{row.pointsAgainst}</TableCell>
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
      </div>
    </div>
  );
}
