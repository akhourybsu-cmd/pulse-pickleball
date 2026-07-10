import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, Play, Trophy, AlertCircle, Settings, Trash2, CheckCircle, Monitor, Users, Calendar, MapPin, Zap, RefreshCw, MoreVertical, Medal } from "lucide-react";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
import { ScoreManagementDialog } from "@/components/round-robin/ScoreManagementDialog";
import { useMode } from "@/contexts/ModeContext";
import { getVenueLogoSrc, getVenueLogoFallback } from "@/lib/venueBranding";
import { suggestRounds } from "@/lib/roundRobinFairness";
import { useVenueTheme } from "@/components/layout/VenueShell";
import { motion } from "framer-motion";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  games_per_player?: number;
  current_round: number | null;
  status: "draft" | "live" | "completed" | "voided";
  rating_eligible: boolean;
  rating_type: string;
  format?: string;
  venue_id: string | null;
  group_id?: string | null;
}

interface Player {
  id: string;
  event_id: string;
  player_id: string | null;
  guest_player_id?: string | null;
  guest_name?: string | null;
  joined_at: string;
  active: boolean;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
  } | null;
  guest_players?: {
    id: string;
    display_name: string | null;
    linked_user_id: string | null;
  } | null;
}

interface ScheduleMatch {
  id: string;
  event_id: string;
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  match_id: string | null;
}

interface StandingsRow {
  player_id: string;
  player_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
}

export default function VenueRoundRobinDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentVenue } = useMode();
  const venueTheme = useVenueTheme();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [playerManagementOpen, setPlayerManagementOpen] = useState(false);
  const [courtsRoundsOpen, setCourtsRoundsOpen] = useState(false);
  const [scoreManagementOpen, setScoreManagementOpen] = useState(false);

  const logoSrc = getVenueLogoSrc(currentVenue?.logo_url, currentVenue?.venue_name);

  useEffect(() => {
    fetchEventDetails();
    
    const channel = supabase
      .channel('venue-round-robin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_robin_events', filter: `id=eq.${id}` }, () => fetchEventDetails())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_robin_schedule', filter: `event_id=eq.${id}` }, () => fetchEventDetails())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: playersData } = await supabase
        .from("round_robin_players")
        .select("*, profiles:profiles_public!round_robin_players_player_id_fkey(*), guest_players:guest_players!round_robin_players_guest_player_id_fkey(id, display_name, linked_user_id)")
        .eq("event_id", id);

      setPlayers(playersData || []);

      const { data: scheduleData } = await supabase
        .from("round_robin_schedule")
        .select(`*, a1_profile:profiles_public!round_robin_schedule_a1_player_id_fkey(display_name, full_name), a2_profile:profiles_public!round_robin_schedule_a2_player_id_fkey(display_name, full_name), b1_profile:profiles_public!round_robin_schedule_b1_player_id_fkey(display_name, full_name), b2_profile:profiles_public!round_robin_schedule_b2_player_id_fkey(display_name, full_name)`)
        .eq("event_id", id)
        .order("round_no")
        .order("court_no");

      setSchedule(scheduleData || []);
      if (scheduleData && playersData) {
        calculateStandings(scheduleData, playersData);
      }
    } catch (error: any) {
      toast.error("Failed to load event");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStandings = (scheduleData: ScheduleMatch[], playersData: Player[]) => {
    const stats: Record<string, StandingsRow> = {};
    playersData.filter(p => p.active).forEach((p) => {
      const key = p.player_id || p.guest_player_id;
      if (!key) return;
      const guestName = p.guest_players?.display_name || p.guest_name || "Guest";
      const guestLinked = !!p.guest_players?.linked_user_id;
      const name = p.profiles
        ? p.profiles.display_name || p.profiles.full_name
        : guestLinked ? guestName : `${guestName} (G)`;
      stats[key] = {
        player_id: key,
        player_name: name,
        wins: 0, losses: 0, points_for: 0, points_against: 0, point_diff: 0,
      };
    });

    scheduleData.forEach((match) => {
      if (!match.is_bye && match.team1_score !== null && match.team2_score !== null) {
        const team1Won = match.team1_score > match.team2_score;
        [match.a1_player_id, match.a2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team1_score!;
            stats[pid].points_against += match.team2_score!;
            if (team1Won) stats[pid].wins++; else stats[pid].losses++;
          }
        });
        [match.b1_player_id, match.b2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team2_score!;
            stats[pid].points_against += match.team1_score!;
            if (!team1Won) stats[pid].wins++; else stats[pid].losses++;
          }
        });
      }
    });

    setStandings(
      Object.values(stats)
        .map(s => ({ ...s, point_diff: s.points_for - s.points_against }))
        .sort((a, b) => b.wins - a.wins || b.point_diff - a.point_diff)
    );
  };

  const handleGenerateSchedule = async () => {
    if (!event) return;
    const activePlayers = players.filter(p => p.active);
    if (activePlayers.length < 4) {
      toast.error("At least 4 players required");
      return;
    }

    // Guest scheduling is not wired into the generator yet — bail with a
    // clear message rather than silently writing nulls into the schedule FK.
    const guestParticipants = activePlayers.filter(
      (p) => !(p as { player_id?: string }).player_id ||
        (p as { guest_player_id?: string }).guest_player_id,
    );
    if (guestParticipants.length > 0) {
      toast.error(
        "Guest players can't be scheduled yet. Remove guests or convert them to registered players first.",
      );
      return;
    }


    try {
      const { error } = await supabase.functions.invoke("generate-round-robin-schedule", {
        body: {
          event_id: event.id,
          player_ids: activePlayers.map(p => p.player_id),
          num_courts: event.num_courts,
          num_rounds: event.num_rounds,
          games_per_player: event.games_per_player || 3,
        },
      });
      if (error) throw error;
      toast.success("Schedule generated!");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to generate schedule");
    }
  };

  const handleStartEvent = async () => {
    const { error } = await supabase.from("round_robin_events").update({ status: "live", current_round: 1 }).eq("id", id);
    if (!error) {
      toast.success("Event started!");
      fetchEventDetails();
    }
  };

  const handleCompleteEvent = async () => {
    const { error } = await supabase.from("round_robin_events").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    if (!error) {
      toast.success("Event completed!");
      fetchEventDetails();
    }
  };

  const handleDeleteEvent = async () => {
    const { error } = await supabase.rpc("delete_round_robin_event", { p_event_id: id });
    if (!error) {
      toast.success("Event deleted");
      navigate("/venue/round-robins");
    } else {
      toast.error("Failed to delete");
    }
    setDeleteDialogOpen(false);
  };

  const getPlayerName = (playerId: string | null, matchData?: any) => {
    if (!playerId) return "—";
    if (matchData) {
      const profileKey = 
        playerId === matchData.a1_player_id ? 'a1_profile' :
        playerId === matchData.a2_player_id ? 'a2_profile' :
        playerId === matchData.b1_player_id ? 'b1_profile' :
        playerId === matchData.b2_player_id ? 'b2_profile' : null;
      if (profileKey && matchData[profileKey]) {
        return matchData[profileKey].display_name || matchData[profileKey].full_name;
      }
    }
    const player = players.find(p => p.player_id === playerId);
    return player?.profiles?.display_name || player?.profiles?.full_name || "Unknown";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="relative h-16 w-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-muted-foreground">Loading event...</p>
        </motion.div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 text-center">
        <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
        <p className="text-muted-foreground mb-4">Event not found</p>
        <Button onClick={() => navigate("/venue/round-robins")} variant="outline">
          Go Back
        </Button>
      </div>
    );
  }

  const activePlayers = players.filter(p => p.active);
  const hasSchedule = schedule.length > 0;
  const canStart = event.status === "draft" && hasSchedule;
  const isLive = event.status === "live";
  const isCompleted = event.status === "completed";

  return (
    <div className="min-h-screen">
      {/* Premium Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-4"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate("/venue/round-robins")}
            className="hover:bg-muted/80"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <img 
            src={logoSrc} 
            alt="Venue" 
            className="h-10 w-auto" 
            onError={(e) => { e.currentTarget.src = getVenueLogoFallback(); }} 
          />
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{event.name}</h1>
              {isLive ? (
                <Badge 
                  className="text-white shadow-[0_0_12px_rgba(197,232,108,0.5)]"
                  style={{ backgroundColor: venueTheme.primary }}
                >
                  <span className="mr-2 relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  LIVE
                </Badge>
              ) : isCompleted ? (
                <Badge variant="secondary">
                  <Trophy className="h-3 w-3 mr-1" />
                  COMPLETED
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">DRAFT</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(parseISO(event.date), "MMM d, yyyy")} • {activePlayers.length} players • {event.num_courts} courts
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLive && (
              <Button 
                variant="outline" 
                onClick={() => navigate(`/venue/round-robins/${id}/kiosk`)}
                className="border-2 hover:shadow-md transition-all"
                style={{ borderColor: venueTheme.primary, color: venueTheme.primary }}
              >
                <Monitor className="h-4 w-4 mr-2" />
                Kiosk
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="hover:bg-muted/80">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 backdrop-blur-sm bg-popover/95">
                <DropdownMenuItem onClick={() => setPlayerManagementOpen(true)}>
                  <Users className="h-4 w-4 mr-2" />Manage Players
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCourtsRoundsOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />Courts & Rounds
                </DropdownMenuItem>
                {(isLive || isCompleted) && (
                  <DropdownMenuItem onClick={() => setScoreManagementOpen(true)}>
                    <Trophy className="h-4 w-4 mr-2" />Edit Scores
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {event.status === "draft" && (
                  <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />Delete Event
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>

      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        {/* Action Cards */}
        {event.status === "draft" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-dashed border-2 bg-gradient-to-r from-card to-muted/30">
              <CardContent className="py-6">
                <div className="flex flex-wrap gap-3">
                  <Button 
                    onClick={handleGenerateSchedule} 
                    disabled={activePlayers.length < 4}
                    variant="outline"
                    className="border-2 hover:shadow-md transition-all"
                    style={{ borderColor: venueTheme.primary, color: venueTheme.primary }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {hasSchedule ? "Regenerate Schedule" : "Generate Schedule"}
                  </Button>
                  {canStart && (
                    <Button 
                      onClick={handleStartEvent} 
                      className="text-white shadow-lg hover:shadow-xl transition-all"
                      style={{ backgroundColor: venueTheme.primary }}
                    >
                      <Play className="h-4 w-4 mr-2" />Start Event
                    </Button>
                  )}
                </div>
                {activePlayers.length < 4 && (
                  <Alert className="mt-4 border-amber-500/50 bg-amber-500/10">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      Add at least 4 players to generate a schedule
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isLive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-2 shadow-lg" style={{ borderColor: `${venueTheme.primary}40` }}>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">Round {event.current_round} of {event.num_rounds}</p>
                    <p className="text-sm text-muted-foreground">Enter scores for all matches, then advance or complete</p>
                  </div>
                  <Button 
                    onClick={handleCompleteEvent} 
                    className="text-white shadow-lg hover:shadow-xl transition-all"
                    style={{ backgroundColor: venueTheme.primary }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />Complete Event
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Premium Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Tabs defaultValue="schedule" className="space-y-6">
            <TabsList className="w-full max-w-md mx-auto grid grid-cols-3 p-1 bg-card/80 backdrop-blur-sm border border-border/50 rounded-xl shadow-sm">
              <TabsTrigger 
                value="schedule"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </TabsTrigger>
              <TabsTrigger 
                value="standings"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Trophy className="h-4 w-4 mr-2" />
                Standings
              </TabsTrigger>
              <TabsTrigger 
                value="players"
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg transition-all"
              >
                <Users className="h-4 w-4 mr-2" />
                Players
              </TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              {hasSchedule ? (
                <ScheduleRoundCarousel
                  totalRounds={event.num_rounds}
                  currentRound={event.current_round || 1}
                >
                  {(roundNo) => {
                    const roundMatches = schedule.filter(m => m.round_no === roundNo && !m.is_bye);
                    const currentRound = event.current_round || 1;
                    const isCurrentRound = roundNo === currentRound;
                    const isFutureRound = roundNo > currentRound;
                    
                    return (
                      <div className={`space-y-4 ${isFutureRound ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-center gap-3">
                          <div className="h-px bg-border flex-1 max-w-12" />
                          <div 
                            className={`text-lg font-bold px-5 py-2.5 rounded-full transition-all ${
                              isCurrentRound && isLive 
                                ? 'text-white shadow-lg' 
                                : 'bg-muted'
                            }`}
                            style={isCurrentRound && isLive ? { 
                              backgroundColor: venueTheme.primary,
                              boxShadow: `0 0 20px ${venueTheme.primary}60`
                            } : undefined}
                          >
                            Round {roundNo}
                            {isCurrentRound && isLive && <span className="ml-2 text-xs opacity-90">(Active)</span>}
                          </div>
                          <div className="h-px bg-border flex-1 max-w-12" />
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          {roundMatches.map((match, idx) => {
                            const isCompleted = match.team1_score !== null && match.team2_score !== null;
                            const team1Won = isCompleted && match.team1_score! > match.team2_score!;
                            const team2Won = isCompleted && match.team2_score! > match.team1_score!;

                            return (
                              <motion.div
                                key={match.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                              >
                                <Card className={`transition-all ${isFutureRound ? 'pointer-events-none' : 'hover:shadow-md'} ${
                                  isCompleted ? 'bg-gradient-to-r from-card to-muted/30' : ''
                                }`}>
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                      <Badge variant="outline" className="font-mono bg-muted/50">Court {match.court_no}</Badge>
                                      {isCompleted && (
                                        <Badge variant="secondary" className="text-xs">
                                          <CheckCircle className="h-3 w-3 mr-1" />
                                          Completed
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <div className="space-y-2">
                                      <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                        team1Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        <div className={`text-sm truncate flex-1 ${team1Won ? 'font-semibold' : ''}`}>
                                          {getPlayerName(match.a1_player_id, match)} / {getPlayerName(match.a2_player_id, match)}
                                        </div>
                                        <div className={`text-xl font-bold ml-2 font-mono ${team1Won ? 'text-primary' : ''}`}>
                                          {match.team1_score ?? '—'}
                                        </div>
                                      </div>
                                      <div className={`flex items-center justify-between p-3 rounded-xl transition-colors ${
                                        team2Won 
                                          ? 'bg-primary/15 border border-primary/30' 
                                          : 'bg-muted/50'
                                      }`}>
                                        <div className={`text-sm truncate flex-1 ${team2Won ? 'font-semibold' : ''}`}>
                                          {getPlayerName(match.b1_player_id, match)} / {getPlayerName(match.b2_player_id, match)}
                                        </div>
                                        <div className={`text-xl font-bold ml-2 font-mono ${team2Won ? 'text-primary' : ''}`}>
                                          {match.team2_score ?? '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                </ScheduleRoundCarousel>
              ) : (
                <Card className="border-dashed border-2">
                  <CardContent className="py-12 text-center">
                    <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                      <Calendar className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No Schedule Yet</h3>
                    <p className="text-muted-foreground">Generate a schedule to see matches here</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="standings">
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-card to-muted/30 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    Standings
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {standings.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/30">
                            <th className="text-center py-3 px-4 font-semibold w-16">#</th>
                            <th className="text-left py-3 px-4 font-semibold">Player</th>
                            <th className="text-center py-3 px-4 font-semibold text-primary">W</th>
                            <th className="text-center py-3 px-4 font-semibold text-destructive">L</th>
                            <th className="text-center py-3 px-4 font-semibold">PF</th>
                            <th className="text-center py-3 px-4 font-semibold">PA</th>
                            <th className="text-center py-3 px-4 font-semibold">+/-</th>
                          </tr>
                        </thead>
                        <tbody>
                          {standings.map((row, i) => {
                            const isTopThree = i < 3;
                            return (
                              <tr 
                                key={row.player_id} 
                                className={`border-b last:border-0 transition-colors hover:bg-muted/50 ${
                                  isTopThree ? 'bg-secondary/5' : ''
                                }`}
                              >
                                <td className="py-3 px-4 text-center">
                                  {i === 0 ? (
                                    <Medal className="h-5 w-5 text-yellow-500 mx-auto" />
                                  ) : i === 1 ? (
                                    <Medal className="h-5 w-5 text-gray-400 mx-auto" />
                                  ) : i === 2 ? (
                                    <Medal className="h-5 w-5 text-amber-700 mx-auto" />
                                  ) : (
                                    <span className="font-medium text-muted-foreground">{i + 1}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 font-medium">{row.player_name}</td>
                                <td className="text-center py-3 px-4 text-primary font-semibold">{row.wins}</td>
                                <td className="text-center py-3 px-4 text-destructive font-semibold">{row.losses}</td>
                                <td className="text-center py-3 px-4 text-muted-foreground">{row.points_for}</td>
                                <td className="text-center py-3 px-4 text-muted-foreground">{row.points_against}</td>
                                <td className={`text-center py-3 px-4 font-semibold ${
                                  row.point_diff > 0 ? "text-primary" : row.point_diff < 0 ? "text-destructive" : "text-muted-foreground"
                                }`}>
                                  {row.point_diff > 0 ? "+" : ""}{row.point_diff}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-12">No scores recorded yet</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="players">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-r from-card to-muted/30 border-b border-border/50">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Players ({activePlayers.length})
                  </CardTitle>
                  <Button size="sm" onClick={() => setPlayerManagementOpen(true)} className="shadow-sm">
                    <Users className="h-4 w-4 mr-2" />Manage
                  </Button>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {activePlayers.map((p, idx) => (
                      <motion.div 
                        key={p.id} 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="p-4 bg-muted/50 rounded-xl border border-border/50 hover:border-primary/30 hover:shadow-sm transition-all"
                      >
                        <p className="font-medium truncate">{p.profiles?.display_name || p.profiles?.full_name || p.guest_players?.display_name || p.guest_name || 'Guest'}{!p.profiles && !p.guest_players?.linked_user_id ? ' (G)' : ''}</p>
                      </motion.div>
                    ))}
                  </div>
                  {activePlayers.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="text-muted-foreground">No players added yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      {/* Dialogs */}
      <PlayerManagementDialog
        open={playerManagementOpen}
        onOpenChange={setPlayerManagementOpen}
        players={players}
        currentRound={event.current_round}
        totalRounds={event.num_rounds}
        groupId={event.group_id}
        genderFilter={event.format === "male" ? "male" : event.format === "female" ? "female" : undefined}
        onAddPlayer={async ({ playerId, guestPlayerId, guestName }) => {
          // Reactivate an existing inactive roster row (removed /
          // substituted-out member coming back) — a blind insert would hit
          // the partial unique index on (event_id, player_id/guest_id).
          const existing = players.find((p) =>
            (playerId && p.player_id === playerId) ||
            (guestPlayerId && (p as any).guest_player_id === guestPlayerId)
          );
          if (existing) {
            if (!existing.active) {
              await supabase.from("round_robin_players").update({ active: true }).eq("id", existing.id);
            }
          } else {
            await supabase.from("round_robin_players").insert({
              event_id: event.id,
              player_id: playerId,
              guest_player_id: guestPlayerId ?? null,
              guest_name: guestName ?? null,
            } as never);
          }
          fetchEventDetails();
        }}
        onMarkInactive={async (playerEventId: string) => {
          await supabase.from("round_robin_players").update({ active: false }).eq("id", playerEventId);
          fetchEventDetails();
        }}
        onSubstitute={async (originalRosterId, replacement, scope) => {
          // Guest-aware in-place seat swap. Resolve the original's player/
          // guest id from the roster row, then patch each seat that holds
          // them — setting the replacement's player_id OR guest_id (the DB
          // XOR keeps exactly one populated per seat).
          const original = players.find((p) => p.id === originalRosterId);
          if (!original) return;
          const origPid = original.player_id;
          const origGid = original.guest_player_id;
          const fromRound = scope === 'global' ? (event.current_round || 1) : (scope as number);
          const toRound = scope === 'global' ? undefined : (scope as number);
          const seats = ['a1', 'a2', 'b1', 'b2'] as const;

          const targets = schedule.filter((s: any) =>
            s.round_no >= fromRound &&
            (toRound === undefined || s.round_no === toRound) &&
            !s.is_bye &&
            s.team1_score === null &&
            s.team2_score === null
          );

          for (const match of targets) {
            const m = match as any;
            const updates: any = {};
            for (const seat of seats) {
              const holdsOriginal =
                (origPid && m[`${seat}_player_id`] === origPid) ||
                (origGid && m[`${seat}_guest_id`] === origGid);
              if (holdsOriginal) {
                updates[`${seat}_player_id`] = replacement.playerId ?? null;
                updates[`${seat}_guest_id`] = replacement.guestPlayerId ?? null;
              }
            }
            if (Object.keys(updates).length > 0) {
              await supabase.from("round_robin_schedule").update(updates).eq("id", m.id);
            }
          }
          fetchEventDetails();
        }}
      />

      <CourtsRoundsDialog
        open={courtsRoundsOpen}
        onOpenChange={setCourtsRoundsOpen}
        currentCourts={event.num_courts}
        currentGamesPerPlayer={event.games_per_player || 3}
        currentRound={event.current_round || 0}
        hasScores={schedule.some(s => s.team1_score !== null)}
        totalPlayers={activePlayers.length}
        onUpdateCourts={async (courts) => {
          await supabase.from("round_robin_events").update({ num_courts: courts }).eq("id", id);
          fetchEventDetails();
        }}
        onUpdateGamesPerPlayer={async (games) => {
          const newRounds = suggestRounds(activePlayers.length, event.num_courts, games);
          await supabase.from("round_robin_events").update({ games_per_player: games, num_rounds: newRounds }).eq("id", id);
          fetchEventDetails();
        }}
      />

      <ScoreManagementDialog
        open={scoreManagementOpen}
        onOpenChange={setScoreManagementOpen}
        schedule={schedule}
        isAdmin={true}
        ratingEligible={event.rating_eligible}
        getPlayerName={(playerId) => getPlayerName(playerId)}
        onEditScore={async (matchId: string, team1Score: number, team2Score: number) => {
          await supabase.from("round_robin_schedule").update({ team1_score: team1Score, team2_score: team2Score }).eq("id", matchId);
          fetchEventDetails();
        }}
        onVoidMatch={async (matchId: string) => {
          await supabase.from("round_robin_schedule").update({ team1_score: null, team2_score: null }).eq("id", matchId);
          fetchEventDetails();
        }}
        onDeleteMatch={async (matchId: string) => {
          await supabase.from("round_robin_schedule").delete().eq("id", matchId);
          fetchEventDetails();
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Round Robin?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this round robin and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
