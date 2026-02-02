import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Trophy, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Session {
  id: string;
  name: string;
  num_courts: number;
  created_by: string;
  courts: {
    name: string;
  };
}

interface MatchTicket {
  id: string;
  court_number: number;
  status: string;
  team1_player1: { display_name: string | null; full_name: string };
  team1_player2: { display_name: string | null; full_name: string };
  team2_player1: { display_name: string | null; full_name: string };
  team2_player2: { display_name: string | null; full_name: string };
}

interface QueueEntry {
  id: string;
  profiles: {
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
}

interface CheckIn {
  id: string;
}

export default function Kiosk() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const sessionId = searchParams.get("session");
  const [session, setSession] = useState<Session | null>(null);
  const [matchTickets, setMatchTickets] = useState<MatchTicket[]>([]);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [checkInCount, setCheckInCount] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionId) {
      checkKioskAccess();
    }
  }, [sessionId]);

  const checkKioskAccess = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to access kiosk mode",
          variant: "destructive",
        });
        navigate(`/session-queue?session=${sessionId}`);
        return;
      }

      const { data: sessionData } = await supabase
        .from("sessions")
        .select("created_by")
        .eq("id", sessionId)
        .single();

      if (!sessionData) {
        toast({
          title: "Session Not Found",
          description: "The requested session could not be found",
          variant: "destructive",
        });
        navigate("/player/dashboard");
        return;
      }

      if (sessionData.created_by !== user.id) {
        toast({
          title: "Access Denied",
          description: "Only the session organizer can access kiosk mode",
          variant: "destructive",
        });
        navigate(`/session-queue?session=${sessionId}`);
        return;
      }

      setIsAuthorized(true);
      fetchSessionData();
    } catch (error) {
      console.error("Error checking kiosk access:", error);
      navigate("/player/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Set up realtime subscriptions with reconnection
  useEffect(() => {
    if (!sessionId) return;

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const setupChannel = () => {
      const channel = supabase
        .channel(`kiosk_${sessionId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'match_tickets',
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            console.log('Kiosk: Match tickets updated');
            fetchSessionData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'queue_entries',
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            console.log('Kiosk: Queue updated');
            fetchSessionData();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'check_ins',
            filter: `session_id=eq.${sessionId}`,
          },
          () => {
            console.log('Kiosk: Check-ins updated');
            fetchSessionData();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Kiosk realtime connected');
            reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('Kiosk realtime error, attempting reconnect...');
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

    // Auto-refresh every 5 seconds for immediate score updates
    const refreshInterval = setInterval(() => {
      fetchSessionData();
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(refreshInterval);
    };
  }, [sessionId]);

  const fetchSessionData = async () => {
    if (!sessionId) return;

    // Fetch session
    const { data: sessionData } = await supabase
      .from("sessions")
      .select(`
        *,
        courts:court_id (name)
      `)
      .eq("id", sessionId)
      .eq("status", "active")
      .single();

    if (sessionData) {
      setSession(sessionData);
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
      .in("status", ["live", "on-deck"])
      .order("court_number", { ascending: true });

    if (ticketsData) {
      setMatchTickets(ticketsData as any);
    }

    // Fetch queue
    const { data: queueData } = await supabase
      .from("queue_entries")
      .select(`
        id,
        profiles:player_id (display_name, full_name, current_rating)
      `)
      .eq("session_id", sessionId)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true });

    if (queueData) {
      setQueueEntries(queueData as any);
    }

    // Fetch check-in count
    const { data: checkInsData } = await supabase
      .from("check_ins")
      .select("id")
      .eq("session_id", sessionId)
      .eq("status", "active");

    if (checkInsData) {
      setCheckInCount(checkInsData.length);
    }
  };

  const getPlayerName = (player: { display_name: string | null; full_name: string }) => {
    return player.display_name || player.full_name;
  };

  const liveMatches = matchTickets.filter(t => t.status === "live");
  const onDeckMatches = matchTickets.filter(t => t.status === "on-deck");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading kiosk...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="text-center">
          <Lock className="w-24 h-24 mx-auto mb-4 text-destructive" />
          <h1 className="text-4xl font-bold mb-2">Access Denied</h1>
          <p className="text-xl text-muted-foreground">Only the session organizer can access kiosk mode</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary/10">
        <div className="text-center">
          <Trophy className="w-24 h-24 mx-auto mb-4 text-primary" />
          <h1 className="text-4xl font-bold mb-2">No Active Session</h1>
          <p className="text-xl text-muted-foreground">Waiting for session to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/10 p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold mb-2">{session.name}</h1>
            <p className="text-2xl text-muted-foreground">{session.courts.name}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="text-xl text-muted-foreground flex items-center justify-end gap-2 mt-2">
              <Users className="w-6 h-6" />
              {checkInCount} Players Checked In
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column - On Court */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-primary" />
            <h2 className="text-4xl font-bold">On Court</h2>
          </div>
          
          {liveMatches.length === 0 ? (
            <Card className="border-2">
              <CardContent className="p-12 text-center">
                <p className="text-2xl text-muted-foreground">No active matches</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {liveMatches.map((ticket) => (
                <Card key={ticket.id} className="border-4 border-primary shadow-lg">
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-bold">
                          {ticket.court_number}
                        </div>
                        <span className="text-3xl font-bold">Court {ticket.court_number}</span>
                      </div>
                      <Badge variant="default" className="text-xl px-6 py-2">
                        PLAYING
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <p className="text-xl font-semibold text-muted-foreground">Team 1</p>
                        <p className="text-2xl font-bold">{getPlayerName(ticket.team1_player1)}</p>
                        <p className="text-2xl font-bold">{getPlayerName(ticket.team1_player2)}</p>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xl font-semibold text-muted-foreground">Team 2</p>
                        <p className="text-2xl font-bold">{getPlayerName(ticket.team2_player1)}</p>
                        <p className="text-2xl font-bold">{getPlayerName(ticket.team2_player2)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* On Deck */}
          {onDeckMatches.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-8 h-8 text-orange-500" />
                <h2 className="text-4xl font-bold">On Deck</h2>
              </div>
              <div className="space-y-4">
                {onDeckMatches.map((ticket) => (
                  <Card key={ticket.id} className="border-2 border-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-2xl font-bold">Court {ticket.court_number}</span>
                        <Badge variant="secondary" className="text-lg px-4 py-1">
                          Next Up
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-6 text-lg">
                        <div>
                          <p className="font-medium text-muted-foreground mb-2">Team 1</p>
                          <p>{getPlayerName(ticket.team1_player1)}</p>
                          <p>{getPlayerName(ticket.team1_player2)}</p>
                        </div>
                        <div>
                          <p className="font-medium text-muted-foreground mb-2">Team 2</p>
                          <p>{getPlayerName(ticket.team2_player1)}</p>
                          <p>{getPlayerName(ticket.team2_player2)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Queue */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8 text-blue-500" />
            <h2 className="text-4xl font-bold">Queue</h2>
            <Badge variant="outline" className="text-2xl px-4 py-2 ml-auto">
              {queueEntries.length}
            </Badge>
          </div>

          <Card className="border-2">
            <CardContent className="p-6">
              {queueEntries.length === 0 ? (
                <p className="text-xl text-muted-foreground text-center py-8">
                  Queue is empty
                </p>
              ) : (
                <div className="space-y-3">
                  {queueEntries.slice(0, 12).map((entry, index) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-4 p-4 rounded-lg ${
                        index < 4 ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-secondary/30'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-xl font-semibold">
                          {entry.profiles.display_name || entry.profiles.full_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Rating: {entry.profiles.current_rating.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {queueEntries.length > 12 && (
                    <p className="text-center text-muted-foreground pt-4">
                      +{queueEntries.length - 12} more waiting
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
