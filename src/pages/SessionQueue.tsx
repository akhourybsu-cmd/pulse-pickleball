import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, Clock, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface Session {
  id: string;
  name: string;
  session_date: string;
  start_time: string;
  num_courts: number;
  status: string;
  courts: {
    name: string;
  };
}

interface CheckIn {
  id: string;
  player_id: string;
  status: string;
  checked_in_at: string;
  profiles: {
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
}

interface QueueEntry {
  id: string;
  player_id: string;
  joined_at: string;
  games_played: number;
  profiles: {
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
}

interface MatchTicket {
  id: string;
  court_number: number;
  status: string;
  team1_score: number | null;
  team2_score: number | null;
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  team1_player1: {
    display_name: string | null;
    full_name: string;
  };
  team1_player2: {
    display_name: string | null;
    full_name: string;
  };
  team2_player1: {
    display_name: string | null;
    full_name: string;
  };
  team2_player2: {
    display_name: string | null;
    full_name: string;
  };
}

export default function SessionQueue() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [matchTickets, setMatchTickets] = useState<MatchTicket[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isInQueue, setIsInQueue] = useState(false);

  useEffect(() => {
    checkUser();
    fetchActiveSession();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  const fetchActiveSession = async () => {
    try {
      const { data: sessions, error } = await supabase
        .from("sessions")
        .select(`
          *,
          courts:court_id (name)
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      if (sessions && sessions.length > 0) {
        setSession(sessions[0]);
        await fetchSessionData(sessions[0].id);
      }
    } catch (error: any) {
      console.error("Error fetching session:", error);
      toast({
        title: "Error",
        description: "Failed to load active session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionData = async (sessionId: string) => {
    if (!userId) return;

    // Fetch check-ins
    const { data: checkInsData } = await supabase
      .from("check_ins")
      .select(`
        *,
        profiles:player_id (display_name, full_name, current_rating)
      `)
      .eq("session_id", sessionId)
      .eq("status", "active");

    if (checkInsData) {
      setCheckIns(checkInsData as any);
      setIsCheckedIn(checkInsData.some((c: any) => c.player_id === userId));
    }

    // Fetch queue
    const { data: queueData } = await supabase
      .from("queue_entries")
      .select(`
        *,
        profiles:player_id (display_name, full_name, current_rating)
      `)
      .eq("session_id", sessionId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (queueData) {
      setQueueEntries(queueData as any);
      setIsInQueue(queueData.some((q: any) => q.player_id === userId));
    }

    // Fetch match tickets
    const { data: ticketsData } = await supabase
      .from("match_tickets")
      .select(`
        *,
        team1_player1:team1_player1_id (display_name, full_name),
        team1_player2:team1_player2_id (display_name, full_name),
        team2_player1:team2_player1_id (display_name, full_name),
        team2_player2:team2_player2_id (display_name, full_name)
      `)
      .eq("session_id", sessionId)
      .in("status", ["on-deck", "live"])
      .order("court_number", { ascending: true });

    if (ticketsData) {
      setMatchTickets(ticketsData as any);
    }
  };

  const handleCheckIn = async () => {
    if (!userId || !session) return;

    try {
      const { error } = await supabase
        .from("check_ins")
        .insert({
          session_id: session.id,
          player_id: userId,
          status: "active",
        });

      if (error) throw error;

      toast({
        title: "Checked In!",
        description: "You're now checked in to the session",
      });

      await fetchSessionData(session.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleJoinQueue = async () => {
    if (!userId || !session) return;

    try {
      const { error } = await supabase
        .from("queue_entries")
        .insert({
          session_id: session.id,
          player_id: userId,
          status: "waiting",
        });

      if (error) throw error;

      toast({
        title: "Joined Queue!",
        description: "You're now in the queue",
      });

      await fetchSessionData(session.id);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="border-b bg-secondary/30">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>No Active Session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                There are no active sessions at the moment. Check back later or contact an admin.
              </p>
              <Button onClick={() => navigate("/dashboard")} className="w-full">
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 space-y-6">
        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {session.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Venue:</strong> {session.courts.name}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Courts:</strong> {session.num_courts}
            </p>
            <p className="text-sm text-muted-foreground">
              <strong>Start Time:</strong> {session.start_time}
            </p>
            {!isCheckedIn && (
              <Button onClick={handleCheckIn} className="w-full mt-4">
                Check In
              </Button>
            )}
            {isCheckedIn && !isInQueue && (
              <Button onClick={handleJoinQueue} className="w-full mt-4">
                Join Queue
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Match Tickets - On Court / On Deck */}
        {matchTickets.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Courts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {matchTickets.map((ticket) => {
                const isMyMatch = userId && [
                  ticket.team1_player1_id,
                  ticket.team1_player2_id,
                  ticket.team2_player1_id,
                  ticket.team2_player2_id,
                ].includes(userId);

                return (
                  <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Court {ticket.court_number}</p>
                      <Badge variant={ticket.status === "live" ? "default" : "secondary"}>
                        {ticket.status === "live" ? "On Court" : "On Deck"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Team 1</p>
                        <p>{ticket.team1_player1.display_name || ticket.team1_player1.full_name}</p>
                        <p>{ticket.team1_player2.display_name || ticket.team1_player2.full_name}</p>
                      </div>
                      <div>
                        <p className="font-medium">Team 2</p>
                        <p>{ticket.team2_player1.display_name || ticket.team2_player1.full_name}</p>
                        <p>{ticket.team2_player2.display_name || ticket.team2_player2.full_name}</p>
                      </div>
                    </div>
                    {isMyMatch && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => navigate(`/match/ticket/${ticket.id}`)}
                      >
                        Submit Score
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Queue */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Queue ({queueEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queueEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players in queue</p>
            ) : (
              <div className="space-y-2">
                {queueEntries.map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-muted-foreground">#{index + 1}</span>
                      <div>
                        <p className="font-medium">
                          {entry.profiles.display_name || entry.profiles.full_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Rating: {entry.profiles.current_rating.toFixed(2)} • Games: {entry.games_played}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checked In Players */}
        <Card>
          <CardHeader>
            <CardTitle>Checked In ({checkIns.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {checkIns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No players checked in</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {checkIns.map((checkIn) => (
                  <div key={checkIn.id} className="p-2 border rounded text-sm">
                    <p className="font-medium">
                      {checkIn.profiles.display_name || checkIn.profiles.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {checkIn.profiles.current_rating.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
