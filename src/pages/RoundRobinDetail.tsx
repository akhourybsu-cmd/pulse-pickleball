import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Trophy, Play, SkipForward, Settings, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  status: string;
  current_round: number;
  num_rounds: number;
  num_courts: number;
  organizer_id: string;
  rating_eligible: boolean;
  rating_type: string;
  notes: string | null;
}

interface Player {
  id: string;
  player_id: string;
  active: boolean;
  profiles: {
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
  is_bye: boolean;
  match_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
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

interface MatchScore {
  team1_score: number;
  team2_score: number;
}

export default function RoundRobinDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedule, setSchedule] = useState<ScheduleMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, MatchScore>>({});
  const [savingScore, setSavingScore] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsRow[]>([]);

  useEffect(() => {
    fetchEventDetails();
  }, [id]);

  const fetchEventDetails = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", id)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);
      setIsOrganizer(eventData.organizer_id === user.id);

      // Fetch players
      const { data: playersData, error: playersError } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          player_id,
          active,
          profiles (
            full_name,
            display_name
          )
        `)
        .eq("event_id", id);

      if (playersError) throw playersError;
      setPlayers(playersData || []);

      // Fetch schedule
      const { data: scheduleData, error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .select("*")
        .eq("event_id", id)
        .order("round_no")
        .order("court_no");

      if (scheduleError) throw scheduleError;
      setSchedule(scheduleData || []);

      // Calculate standings
      calculateStandings(scheduleData || [], playersData || []);
    } catch (error: any) {
      toast.error("Failed to load event");
      console.error(error);
      navigate("/round-robin");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSchedule = async () => {
    if (!event) return;

    const activePlayers = players.filter((p) => p.active);
    if (activePlayers.length < 4) {
      toast.error("Need at least 4 active players");
      return;
    }

    try {
      // Call edge function to generate schedule
      const { data, error } = await supabase.functions.invoke("generate-round-robin-schedule", {
        body: {
          event_id: event.id,
          player_ids: activePlayers.map((p) => p.player_id),
          num_courts: event.num_courts,
          num_rounds: event.num_rounds,
        },
      });

      if (error) throw error;
      toast.success("Schedule generated!");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to generate schedule");
      console.error(error);
    }
  };

  const handleStartEvent = async () => {
    try {
      const { error } = await supabase
        .from("round_robin_events")
        .update({ status: "live", current_round: 1 })
        .eq("id", id);

      if (error) throw error;
      toast.success("Event started!");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to start event");
      console.error(error);
    }
  };

  const getPlayerName = (playerId: string | null) => {
    if (!playerId) return "—";
    const player = players.find((p) => p.player_id === playerId);
    return player?.profiles.display_name || player?.profiles.full_name || "Unknown";
  };

  const getRoundMatches = (roundNo: number) => {
    return schedule.filter((s) => s.round_no === roundNo);
  };

  const handleScoreChange = (matchId: string, team: 'team1' | 'team2', value: string) => {
    const numValue = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [team === 'team1' ? 'team1_score' : 'team2_score']: numValue,
      }
    }));
  };

  const calculateStandings = (scheduleData: ScheduleMatch[], playersData: Player[]) => {
    const stats: Record<string, StandingsRow> = {};

    playersData.forEach((p) => {
      stats[p.player_id] = {
        player_id: p.player_id,
        player_name: p.profiles.display_name || p.profiles.full_name,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        point_diff: 0,
      };
    });

    scheduleData.forEach((match) => {
      if (!match.is_bye && match.team1_score !== null && match.team2_score !== null) {
        const team1Won = match.team1_score > match.team2_score;

        [match.a1_player_id, match.a2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team1_score;
            stats[pid].points_against += match.team2_score;
            if (team1Won) stats[pid].wins++;
            else stats[pid].losses++;
          }
        });

        [match.b1_player_id, match.b2_player_id].forEach((pid) => {
          if (pid && stats[pid]) {
            stats[pid].points_for += match.team2_score;
            stats[pid].points_against += match.team1_score;
            if (!team1Won) stats[pid].wins++;
            else stats[pid].losses++;
          }
        });
      }
    });

    const standingsArray = Object.values(stats).map((s) => ({
      ...s,
      point_diff: s.points_for - s.points_against,
    }));

    standingsArray.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

    setStandings(standingsArray);
  };

  const handleSaveScore = async (match: ScheduleMatch) => {
    if (!event) return;
    
    const score = scores[match.id];
    if (!score || (score.team1_score === 0 && score.team2_score === 0)) {
      toast.error("Enter valid scores");
      return;
    }

    setSavingScore(match.id);
    try {
      // Just save scores to the schedule table
      const { error: scheduleError } = await supabase
        .from("round_robin_schedule")
        .update({ 
          team1_score: score.team1_score,
          team2_score: score.team2_score 
        })
        .eq("id", match.id);

      if (scheduleError) throw scheduleError;

      toast.success("Score saved!");
      fetchEventDetails();
      
      // Clear the score input
      setScores(prev => {
        const newScores = { ...prev };
        delete newScores[match.id];
        return newScores;
      });
    } catch (error: any) {
      toast.error("Failed to save score");
      console.error(error);
    } finally {
      setSavingScore(null);
    }
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    
    try {
      // Create all matches from schedule
      for (const match of schedule) {
        if (!match.is_bye && match.team1_score !== null && match.team2_score !== null && !match.match_id) {
          const { data: matchData, error: matchError } = await supabase
            .from("matches")
            .insert({
              match_date: event.date,
              team1_score: match.team1_score,
              team2_score: match.team2_score,
              created_by: userId!,
              source: "round_robin",
              event_id: event.id,
              round_no: match.round_no,
              court_no: match.court_no,
              rating_eligible: event.rating_eligible,
              match_type: event.rating_type,
              status: "approved",
            })
            .select()
            .single();

          if (matchError) throw matchError;

          const participants = [
            { match_id: matchData.id, player_id: match.a1_player_id!, team: 1 },
            { match_id: matchData.id, player_id: match.a2_player_id!, team: 1 },
            { match_id: matchData.id, player_id: match.b1_player_id!, team: 2 },
            { match_id: matchData.id, player_id: match.b2_player_id!, team: 2 },
          ];

          const { error: participantsError } = await supabase
            .from("match_participants")
            .insert(participants);

          if (participantsError) throw participantsError;

          await supabase
            .from("round_robin_schedule")
            .update({ match_id: matchData.id })
            .eq("id", match.id);
        }
      }

      // Mark event as completed
      const { error } = await supabase
        .from("round_robin_events")
        .update({ 
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", id);

      if (error) throw error;
      
      toast.success("Event completed! All matches added to history.");
      fetchEventDetails();
    } catch (error: any) {
      toast.error("Failed to complete event");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return null;
  }

  const hasSchedule = schedule.length > 0;
  const canGenerate = players.filter((p) => p.active).length >= 4;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/round-robin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">{event.name}</h1>
              <p className="text-sm text-muted-foreground">
                {new Date(event.date).toLocaleDateString()}
                {event.location && ` • ${event.location}`}
              </p>
            </div>
            <Badge>{event.status.toUpperCase()}</Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {!hasSchedule && isOrganizer && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Schedule not generated yet. Add players and click "Generate Schedule" to begin.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="schedule" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="players">Players ({players.filter(p => p.active).length})</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-6 space-y-6">
            {!hasSchedule ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No schedule generated</p>
                  {isOrganizer && (
                    <Button onClick={handleGenerateSchedule} disabled={!canGenerate}>
                      Generate Schedule
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {isOrganizer && event.status === "draft" && (
                  <Button onClick={handleStartEvent} className="w-full mb-6">
                    <Play className="h-4 w-4 mr-2" />
                    Start Event
                  </Button>
                )}

                {isOrganizer && event.status === "live" && (
                  <Button onClick={handleCompleteEvent} className="w-full mb-6" variant="default">
                    Complete Event & Submit to Match History
                  </Button>
                )}

                <div className="space-y-8">
                  {Array.from({ length: event.num_rounds }, (_, i) => i + 1).map((roundNo) => {
                    const matches = getRoundMatches(roundNo);
                    return (
                      <div key={roundNo} className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-px bg-border flex-1" />
                          <h3 className="text-lg font-bold px-4 py-2 bg-primary/10 rounded-full">
                            Round {roundNo}
                          </h3>
                          <div className="h-px bg-border flex-1" />
                        </div>
                        
                        <div className="grid gap-4 md:grid-cols-2">
                          {matches.map((match) => (
                            <Card key={match.id} className="overflow-hidden">
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="font-mono">Court {match.court_no}</Badge>
                                  {match.team1_score !== null && match.team2_score !== null && (
                                    <Badge variant="secondary">Completed</Badge>
                                  )}
                                </div>
                                
                                {match.is_bye ? (
                                  <p className="text-center text-muted-foreground py-4">— Bye —</p>
                                ) : (
                                  <>
                                    <div className="space-y-2">
                                      <div className={`flex items-center justify-between p-3 rounded-lg ${match.team1_score !== null && match.team1_score > (match.team2_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                        <div className="text-sm">
                                          {getPlayerName(match.a1_player_id)} / {getPlayerName(match.a2_player_id)}
                                        </div>
                                        {match.team1_score !== null ? (
                                          <div className="text-lg font-bold">{match.team1_score}</div>
                                        ) : isOrganizer && event.status === "live" ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            className="w-16 h-8 text-center"
                                            placeholder="0"
                                            value={scores[match.id]?.team1_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team1', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground">—</div>
                                        )}
                                      </div>
                                      
                                      <div className={`flex items-center justify-between p-3 rounded-lg ${match.team2_score !== null && match.team2_score > (match.team1_score || 0) ? 'bg-primary/10 font-semibold' : 'bg-muted/50'}`}>
                                        <div className="text-sm">
                                          {getPlayerName(match.b1_player_id)} / {getPlayerName(match.b2_player_id)}
                                        </div>
                                        {match.team2_score !== null ? (
                                          <div className="text-lg font-bold">{match.team2_score}</div>
                                        ) : isOrganizer && event.status === "live" ? (
                                          <Input
                                            type="number"
                                            min="0"
                                            max="99"
                                            className="w-16 h-8 text-center"
                                            placeholder="0"
                                            value={scores[match.id]?.team2_score ?? ''}
                                            onChange={(e) => handleScoreChange(match.id, 'team2', e.target.value)}
                                          />
                                        ) : (
                                          <div className="text-muted-foreground">—</div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {isOrganizer && event.status === "live" && match.team1_score === null && (
                                      <Button
                                        onClick={() => handleSaveScore(match)}
                                        disabled={savingScore === match.id}
                                        size="sm"
                                        className="w-full"
                                      >
                                        {savingScore === match.id ? "Saving..." : "Save Score"}
                                      </Button>
                                    )}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Participants</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div key={player.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">
                          {player.profiles.display_name || player.profiles.full_name}
                        </div>
                      </div>
                      {!player.active && (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Standings</CardTitle>
                <CardDescription>Based on completed matches</CardDescription>
              </CardHeader>
              <CardContent>
                {standings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No matches completed yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-semibold">#</th>
                          <th className="text-left py-3 px-2 font-semibold">Player</th>
                          <th className="text-center py-3 px-2 font-semibold">W</th>
                          <th className="text-center py-3 px-2 font-semibold">L</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PF</th>
                          <th className="text-center py-3 px-2 font-semibold hidden sm:table-cell">PA</th>
                          <th className="text-center py-3 px-2 font-semibold">+/-</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((row, idx) => (
                          <tr key={row.player_id} className="border-b hover:bg-muted/50">
                            <td className="py-3 px-2">
                              <Badge variant={idx === 0 ? "default" : "outline"} className="w-8 h-8 flex items-center justify-center">
                                {idx + 1}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 font-medium">{row.player_name}</td>
                            <td className="text-center py-3 px-2 font-semibold text-green-600">{row.wins}</td>
                            <td className="text-center py-3 px-2 text-muted-foreground">{row.losses}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_for}</td>
                            <td className="text-center py-3 px-2 hidden sm:table-cell">{row.points_against}</td>
                            <td className={`text-center py-3 px-2 font-semibold ${row.point_diff > 0 ? 'text-green-600' : row.point_diff < 0 ? 'text-red-600' : ''}`}>
                              {row.point_diff > 0 ? '+' : ''}{row.point_diff}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
