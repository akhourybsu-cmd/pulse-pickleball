import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
          <TabsList className="grid w-full grid-cols-3">
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
                  <Button onClick={handleStartEvent} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start Event
                  </Button>
                )}

                {Array.from({ length: event.num_rounds }, (_, i) => i + 1).map((roundNo) => {
                  const matches = getRoundMatches(roundNo);
                  return (
                    <Card key={roundNo}>
                      <CardHeader>
                        <CardTitle>Round {roundNo}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {matches.map((match) => (
                          <div
                            key={match.id}
                            className="p-4 border rounded-lg"
                            onClick={() => {
                              if (isOrganizer && event.status === "live") {
                                navigate(`/round-robin/${event.id}/match/${match.id}`);
                              }
                            }}
                          >
                            <div className="font-semibold mb-2">Court {match.court_no}</div>
                            {match.is_bye ? (
                              <p className="text-sm text-muted-foreground">Bye</p>
                            ) : (
                              <div className="text-sm">
                                <div>
                                  {getPlayerName(match.a1_player_id)} / {getPlayerName(match.a2_player_id)}
                                </div>
                                <div className="text-muted-foreground">vs</div>
                                <div>
                                  {getPlayerName(match.b1_player_id)} / {getPlayerName(match.b2_player_id)}
                                </div>
                              </div>
                            )}
                            {match.match_id && (
                              <Badge variant="secondary" className="mt-2">Completed</Badge>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
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
                <CardDescription>Coming soon</CardDescription>
              </CardHeader>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
