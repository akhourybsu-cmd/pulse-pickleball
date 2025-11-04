import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trophy, Play } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { WhosUpBoard } from "@/components/court/WhosUpBoard";
import { SessionQRCode } from "@/components/court/SessionQRCode";

interface Session {
  id: string;
  name: string;
  session_date: string;
  start_time: string;
  num_courts: number;
  status: string;
  match_type: string;
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
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [matchTickets, setMatchTickets] = useState<MatchTicket[]>([]);
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isInQueue, setIsInQueue] = useState(false);
  const [userQueuePosition, setUserQueuePosition] = useState<number | null>(null);

  useEffect(() => {
    checkUser();
    if (sessionId) {
      fetchSessionById(sessionId);
    } else {
      fetchActiveSession();
    }
    
    // Auto-refresh every 30 seconds as fallback
    const refreshInterval = setInterval(() => {
      if (sessionId) {
        fetchSessionById(sessionId);
      } else {
        fetchActiveSession();
      }
    }, 30000);

    return () => clearInterval(refreshInterval);
  }, [sessionId]);

  // Set up realtime subscriptions with reconnection
  useEffect(() => {
    if (!session) return;

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const setupChannel = () => {
      const channel = supabase
        .channel(`session_${session.id}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userId || 'anonymous' },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'check_ins',
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            console.log('Check-ins updated');
            fetchSessionData(session.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_entries',
            filter: `session_id=eq.${session.id}`,
          },
          () => {
            console.log('Queue updated');
            fetchSessionData(session.id);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'match_tickets',
            filter: `session_id=eq.${session.id}`,
          },
          (payload) => {
            console.log('Match tickets updated', payload);
            fetchSessionData(session.id);
            
            // Show notification if user is assigned to a match
            if (userId && payload.eventType === 'INSERT') {
              const ticket = payload.new;
              const isMyMatch = [
                ticket.team1_player1_id,
                ticket.team1_player2_id,
                ticket.team2_player1_id,
                ticket.team2_player2_id,
              ].includes(userId);

              if (isMyMatch) {
                toast({
                  title: "🎾 You're Up!",
                  description: `Report to Court ${ticket.court_number}`,
                  duration: 10000,
                });
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'sessions',
            filter: `id=eq.${session.id}`,
          },
          (payload) => {
            console.log('Session updated', payload);
            if (payload.new.status === 'completed') {
              toast({
                title: "Session Ended",
                description: "This session has been closed by the admin",
                variant: "destructive",
              });
              setTimeout(() => {
                navigate('/dashboard');
              }, 3000);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime connected');
            reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Realtime error, attempting reconnect...');
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              setTimeout(() => {
                channel.unsubscribe();
                setupChannel();
              }, 1000 * reconnectAttempts);
            }
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, userId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  const fetchSessionById = async (id: string) => {
    try {
      const { data: sessionData, error } = await supabase
        .from("sessions")
        .select(`
          *,
          courts:court_id (name)
        `)
        .eq("id", id)
        .eq("status", "active")
        .single();

      if (error) throw error;

      if (sessionData) {
        setSession(sessionData);
        await fetchSessionData(sessionData.id);
      }
    } catch (error: any) {
      console.error("Error fetching session:", error);
      toast({
        title: "Error",
        description: "Failed to load session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
      const userEntry = queueData.find((q: any) => q.player_id === userId);
      setIsInQueue(!!userEntry);
      if (userEntry) {
        const position = queueData.findIndex((q: any) => q.player_id === userId) + 1;
        setUserQueuePosition(position);
      }
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
        {/* Session Header + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {session.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Facility</p>
                  <p className="font-semibold">{session.courts.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Courts</p>
                  <p className="font-semibold">{session.num_courts}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Start Time</p>
                  <p className="font-semibold">{session.start_time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Checked In</p>
                  <p className="font-semibold">{checkIns.length}</p>
                </div>
              </div>
              
              {!isCheckedIn && (
                <Button onClick={handleCheckIn} className="w-full">
                  Check In
                </Button>
              )}
              {isCheckedIn && !isInQueue && (
                <Button onClick={handleJoinQueue} className="w-full">
                  <Play className="w-4 h-4 mr-2" />
                  Join Queue
                </Button>
              )}
              {isInQueue && userQueuePosition && (
                <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg text-center">
                  <p className="text-sm text-muted-foreground">You're in the queue</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    #{userQueuePosition}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {userQueuePosition <= 4 ? "You're up next!" : `${Math.ceil((userQueuePosition - 4) / 4)} groups ahead`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code */}
          {session.qr_join_url && (
            <SessionQRCode 
              joinUrl={session.qr_join_url} 
              sessionName={session.name} 
            />
          )}
        </div>

        {/* Who's Up Board */}
        <WhosUpBoard
          courtAssignments={matchTickets.map(ticket => ({
            court_number: ticket.court_number,
            status: ticket.status === 'live' ? 'live' : 'on-deck',
            players: [
              {
                id: ticket.team1_player1_id,
                ...ticket.team1_player1,
                current_rating: 3.0 // Default, would need to fetch if needed
              },
              {
                id: ticket.team1_player2_id,
                ...ticket.team1_player2,
                current_rating: 3.0
              },
              {
                id: ticket.team2_player1_id,
                ...ticket.team2_player1,
                current_rating: 3.0
              },
              {
                id: ticket.team2_player2_id,
                ...ticket.team2_player2,
                current_rating: 3.0
              },
            ]
          }))}
          waitingPlayers={queueEntries.map(entry => ({
            id: entry.player_id,
            ...entry.profiles
          }))}
          totalCourts={session.num_courts}
          currentUserId={userId}
        />
      </div>
      <Footer />

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
                          Rating: {entry.profiles.current_rating?.toFixed(2) ?? '3.00'} • Games: {entry.games_played}
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
                      {checkIn.profiles.current_rating?.toFixed(2) ?? '3.00'}
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
