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
import { ArrowLeft, Play, Trophy, AlertCircle, Settings, Trash2, CheckCircle, Monitor, Users, Calendar, MapPin, Zap, RefreshCw, MoreVertical } from "lucide-react";
import { ScheduleRoundCarousel } from "@/components/round-robin/ScheduleRoundCarousel";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { PlayerManagementDialog } from "@/components/round-robin/PlayerManagementDialog";
import { CourtsRoundsDialog } from "@/components/round-robin/CourtsRoundsDialog";
import { ScoreManagementDialog } from "@/components/round-robin/ScoreManagementDialog";
import { useMode } from "@/contexts/ModeContext";
import { getVenueLogoSrc, getVenueLogoFallback } from "@/lib/venueBranding";
import { suggestRounds } from "@/lib/roundRobinFairness";

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
  status: "draft" | "live" | "completed";
  rating_eligible: boolean;
  rating_type: string;
  format?: string;
  venue_id: string | null;
}

interface Player {
  id: string;
  event_id: string;
  player_id: string;
  joined_at: string;
  active: boolean;
  profiles: {
    id: string;
    full_name: string;
    display_name: string | null;
  };
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
        .select("*, profiles(*)")
        .eq("event_id", id);

      setPlayers(playersData || []);

      const { data: scheduleData } = await supabase
        .from("round_robin_schedule")
        .select(`*, a1_profile:profiles!round_robin_schedule_a1_player_id_fkey(display_name, full_name), a2_profile:profiles!round_robin_schedule_a2_player_id_fkey(display_name, full_name), b1_profile:profiles!round_robin_schedule_b1_player_id_fkey(display_name, full_name), b2_profile:profiles!round_robin_schedule_b2_player_id_fkey(display_name, full_name)`)
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
      stats[p.player_id] = {
        player_id: p.player_id,
        player_name: p.profiles.display_name || p.profiles.full_name,
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
    return <div className="p-6 text-center">Loading...</div>;
  }

  if (!event) {
    return <div className="p-6 text-center">Event not found</div>;
  }

  const activePlayers = players.filter(p => p.active);
  const hasSchedule = schedule.length > 0;
  const canStart = event.status === "draft" && hasSchedule;
  const isLive = event.status === "live";
  const isCompleted = event.status === "completed";

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/venue/round-robins")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <img src={logoSrc} alt="Venue" className="h-10 w-auto" onError={(e) => { e.currentTarget.src = getVenueLogoFallback(); }} />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{event.name}</h1>
            <Badge variant={isLive ? "default" : isCompleted ? "secondary" : "outline"} className={isLive ? "bg-green-500 animate-pulse" : ""}>
              {event.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(parseISO(event.date), "MMM d, yyyy")} • {activePlayers.length} players • {event.num_courts} courts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive && (
            <Button variant="outline" onClick={() => navigate(`/venue/round-robins/${id}/kiosk`)}>
              <Monitor className="h-4 w-4 mr-2" />
              Kiosk
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
                <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />Delete Event
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Action Buttons */}
      {event.status === "draft" && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGenerateSchedule} disabled={activePlayers.length < 4}>
                <RefreshCw className="h-4 w-4 mr-2" />
                {hasSchedule ? "Regenerate Schedule" : "Generate Schedule"}
              </Button>
              {canStart && (
                <Button onClick={handleStartEvent} variant="default" className="bg-green-600 hover:bg-green-700">
                  <Play className="h-4 w-4 mr-2" />Start Event
                </Button>
              )}
            </div>
            {activePlayers.length < 4 && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Add at least 4 players to generate a schedule</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {isLive && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Round {event.current_round} of {event.num_rounds}</p>
                <p className="text-sm text-muted-foreground">Enter scores for all matches, then advance or complete</p>
              </div>
              <Button onClick={handleCompleteEvent} variant="default">
                <CheckCircle className="h-4 w-4 mr-2" />Complete Event
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="schedule" className="space-y-4">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="standings">Standings</TabsTrigger>
          <TabsTrigger value="players">Players ({activePlayers.length})</TabsTrigger>
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
                      <div className={`text-lg font-bold px-4 py-2 rounded-full ${isCurrentRound && isLive ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        Round {roundNo}
                        {isCurrentRound && isLive && <span className="ml-2 text-xs">(Active)</span>}
                      </div>
                      <div className="h-px bg-border flex-1 max-w-12" />
                    </div>
                    
                    <div className="grid gap-3 md:grid-cols-2">
                      {roundMatches.map((match) => (
                        <Card key={match.id} className={isFutureRound ? 'pointer-events-none' : ''}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className="font-mono">Court {match.court_no}</Badge>
                              {match.team1_score !== null && match.team2_score !== null && (
                                <Badge variant="secondary">Completed</Badge>
                              )}
                            </div>
                            
                            <div className="space-y-2">
                              <div className={`flex items-center justify-between p-3 rounded-lg ${match.team1_score !== null && match.team1_score > (match.team2_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                <div className="text-sm truncate flex-1">
                                  {getPlayerName(match.a1_player_id, match)} / {getPlayerName(match.a2_player_id, match)}
                                </div>
                                <div className="text-lg font-bold ml-2">{match.team1_score ?? '—'}</div>
                              </div>
                              <div className={`flex items-center justify-between p-3 rounded-lg ${match.team2_score !== null && match.team2_score > (match.team1_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                <div className="text-sm truncate flex-1">
                                  {getPlayerName(match.b1_player_id, match)} / {getPlayerName(match.b2_player_id, match)}
                                </div>
                                <div className="text-lg font-bold ml-2">{match.team2_score ?? '—'}</div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              }}
            </ScheduleRoundCarousel>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Schedule Yet</h3>
                <p className="text-muted-foreground">Generate a schedule to see matches here</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="standings">
          <Card>
            <CardHeader>
              <CardTitle>Standings</CardTitle>
            </CardHeader>
            <CardContent>
              {standings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">#</th>
                        <th className="text-left py-2">Player</th>
                        <th className="text-center py-2">W</th>
                        <th className="text-center py-2">L</th>
                        <th className="text-center py-2">PF</th>
                        <th className="text-center py-2">PA</th>
                        <th className="text-center py-2">+/-</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, i) => (
                        <tr key={row.player_id} className="border-b last:border-0">
                          <td className="py-2 font-medium">{i + 1}</td>
                          <td className="py-2">{row.player_name}</td>
                          <td className="text-center py-2 text-green-600">{row.wins}</td>
                          <td className="text-center py-2 text-red-600">{row.losses}</td>
                          <td className="text-center py-2">{row.points_for}</td>
                          <td className="text-center py-2">{row.points_against}</td>
                          <td className="text-center py-2">{row.point_diff > 0 ? "+" : ""}{row.point_diff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No scores recorded yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="players">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Players</CardTitle>
              <Button size="sm" onClick={() => setPlayerManagementOpen(true)}>
                <Users className="h-4 w-4 mr-2" />Manage
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {activePlayers.map(p => (
                  <div key={p.id} className="p-3 bg-muted rounded-lg">
                    <p className="font-medium truncate">{p.profiles.display_name || p.profiles.full_name}</p>
                  </div>
                ))}
              </div>
              {activePlayers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No players added yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <PlayerManagementDialog
        open={playerManagementOpen}
        onOpenChange={setPlayerManagementOpen}
        players={players}
        currentRound={event.current_round}
        totalRounds={event.num_rounds}
        onAddPlayer={async (playerId: string) => {
          await supabase.from("round_robin_players").insert({ event_id: event.id, player_id: playerId });
          fetchEventDetails();
        }}
        onMarkInactive={async (playerEventId: string) => {
          await supabase.from("round_robin_players").update({ active: false }).eq("id", playerEventId);
          fetchEventDetails();
        }}
        onSubstitute={async (originalPlayerId: string, newPlayerId: string, scope: 'global' | number) => {
          // Handle substitution
          if (scope === 'global') {
            await supabase.from("round_robin_schedule")
              .update({ a1_player_id: newPlayerId })
              .eq("event_id", event.id)
              .eq("a1_player_id", originalPlayerId)
              .gte("round_no", event.current_round || 1);
            await supabase.from("round_robin_schedule")
              .update({ a2_player_id: newPlayerId })
              .eq("event_id", event.id)
              .eq("a2_player_id", originalPlayerId)
              .gte("round_no", event.current_round || 1);
            await supabase.from("round_robin_schedule")
              .update({ b1_player_id: newPlayerId })
              .eq("event_id", event.id)
              .eq("b1_player_id", originalPlayerId)
              .gte("round_no", event.current_round || 1);
            await supabase.from("round_robin_schedule")
              .update({ b2_player_id: newPlayerId })
              .eq("event_id", event.id)
              .eq("b2_player_id", originalPlayerId)
              .gte("round_no", event.current_round || 1);
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
            <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
