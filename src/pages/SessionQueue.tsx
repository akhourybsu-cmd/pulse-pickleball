import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Play } from "lucide-react";
import { Footer } from "@/components/Footer";
import { PageHeader } from "@/components/PageHeader";
import { WhosUpBoard } from "@/components/court/WhosUpBoard";
import { SessionQRCode } from "@/components/court/SessionQRCode";
import { QueueBoxSystem } from "@/components/court/QueueBoxSystem";

interface Session {
  id: string;
  name: string;
  session_date: string;
  start_time: string;
  num_courts: number;
  status: string;
  match_type: string;
  qr_join_url: string | null;
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
    current_rating: number | null;
  };
}

interface QueueEntry {
  id: string;
  player_id: string;
  joined_at: string;
  games_played: number;
  box_number: number | null;
  profiles: {
    display_name: string | null;
    full_name: string;
    current_rating: number | null;
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
  const [userCheckInId, setUserCheckInId] = useState<string | null>(null);
  const [userQueueId, setUserQueueId] = useState<string | null>(null);

  // Define fetchSessionData early so other functions can use it
  const fetchSessionData = useCallback(async (sessionId: string) => {
    try {
      // Fetch all data in parallel for faster updates
      const [checkInsResult, queueResult, ticketsResult] = await Promise.all([
        supabase
          .from("check_ins")
          .select(`
            *,
            profiles:player_id (display_name, full_name, current_rating)
          `)
          .eq("session_id", sessionId)
          .eq("status", "active"),
        
        supabase
          .from("queue_entries")
          .select(`
            *,
            profiles:player_id (display_name, full_name, current_rating)
          `)
          .eq("session_id", sessionId)
          .eq("status", "waiting")
          .order("joined_at", { ascending: true }),
        
        supabase
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
          .order("court_number", { ascending: true })
      ]);

      if (checkInsResult.data) {
        setCheckIns(checkInsResult.data as any);
      }
      if (queueResult.data) {
        setQueueEntries(queueResult.data as any);
      }
      if (ticketsResult.data) {
        setMatchTickets(ticketsResult.data as any);
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
  }, []);

  const checkUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
    
    // Once we have userId, fetch session data if session already loaded
    if (session?.id) {
      await fetchSessionData(session.id);
    }
  }, [session?.id, fetchSessionData, navigate]);

  const fetchSessionById = useCallback(async (id: string) => {
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
  }, [fetchSessionData, toast]);

  const fetchActiveSession = useCallback(async () => {
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
  }, [fetchSessionData, toast]);

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
  }, [sessionId, checkUser, fetchSessionById, fetchActiveSession]);

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
          (payload) => {
            console.log('Check-ins updated:', payload.eventType);
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
          (payload) => {
            console.log('Queue updated:', payload.eventType);
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
            console.log('Match tickets updated:', payload.eventType);
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
            console.log('Session updated:', payload.eventType);
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
            console.log('✅ Realtime subscribed successfully');
            reconnectAttempts = 0;
          } else if (status === 'CHANNEL_ERROR') {
            console.error('❌ Realtime error, attempting reconnect...');
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectAttempts++;
              setTimeout(() => {
                channel.unsubscribe();
                setupChannel();
              }, 1000 * reconnectAttempts);
            }
          } else if (status === 'CLOSED') {
            console.log('🔌 Realtime connection closed');
          }
        });

      return channel;
    };

    const channel = setupChannel();

    return () => {
      console.log('🧹 Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [session, userId, fetchSessionData]);

  // Refetch session data when userId becomes available
  useEffect(() => {
    if (session?.id && userId) {
      fetchSessionData(session.id);
    }
  }, [session?.id, userId]);

  // Track user check-in and queue status whenever data changes
  useEffect(() => {
    if (!session || !userId) return;

    // Check if user is already checked in
    const userCheckIn = checkIns.find(ci => ci.player_id === userId);
    setIsCheckedIn(!!userCheckIn);
    setUserCheckInId(userCheckIn?.id || null);

    // Check if user is in queue
    const userQueue = queueEntries.find(qe => qe.player_id === userId);
    setIsInQueue(!!userQueue);
    setUserQueueId(userQueue?.id || null);

    // Calculate queue position (only for players without box numbers)
    if (userQueue && userQueue.box_number === null) {
      const queueWithoutBoxes = queueEntries
        .filter(qe => qe.box_number === null)
        .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime());
      const position = queueWithoutBoxes.findIndex(qe => qe.player_id === userId) + 1;
      setUserQueuePosition(position);
    } else {
      setUserQueuePosition(null);
    }
  }, [checkIns, queueEntries, userId, session]);

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

  const handleJoinBox = async (boxNumber: number) => {
    if (!userId || !session) return;

    try {
      const { error } = await supabase
        .from("queue_entries")
        .insert({
          session_id: session.id,
          player_id: userId,
          status: "waiting",
          box_number: boxNumber,
        });

      if (error) throw error;

      toast({
        title: "Joined Box!",
        description: `You're now in Box ${boxNumber}`,
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

  const handleCheckOut = async () => {
    if (!userId || !session) return;

    try {
      // Delete check-in
      if (userCheckInId) {
        const { error: checkInError } = await supabase
          .from("check_ins")
          .delete()
          .eq("id", userCheckInId);

        if (checkInError) throw checkInError;
      }

      // Delete queue entry if exists
      if (userQueueId) {
        const { error: queueError } = await supabase
          .from("queue_entries")
          .delete()
          .eq("id", userQueueId);

        if (queueError) throw queueError;
      }

      toast({
        title: "Checked Out",
        description: "You've been removed from the session",
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

  const handleLeaveBox = async () => {
    if (!userId || !session || !userQueueId) return;

    try {
      const { error } = await supabase
        .from("queue_entries")
        .delete()
        .eq("id", userQueueId);

      if (error) throw error;

      toast({
        title: "Left Box",
        description: "You've been removed from the box",
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
        <PageHeader userId={userId} />
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
      <PageHeader userId={userId} />

      <div className="flex-1 container mx-auto px-4 py-8 space-y-6">
        {/* Session Header + Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 rounded-2xl border-2 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
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
              
              {!isCheckedIn ? (
                <Button onClick={handleCheckIn} className="w-full">
                  Check In
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="bg-primary/10 p-4 rounded-lg text-center">
                    <p className="text-sm font-medium text-primary">✓ Checked In</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Join a box below to get in queue
                    </p>
                  </div>
                  <Button 
                    onClick={handleCheckOut} 
                    variant="outline" 
                    className="w-full"
                  >
                    Check Out
                  </Button>
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
          waitingPlayers={queueEntries
            .filter(entry => entry.box_number === null)
            .map(entry => ({
              id: entry.player_id,
              ...entry.profiles
            }))}
          totalCourts={session.num_courts}
          currentUserId={userId}
        />

        {/* Box System - Only show if checked in */}
        {isCheckedIn && (
          <QueueBoxSystem
            sessionId={session.id}
            userId={userId}
            boxEntries={queueEntries.filter(entry => entry.box_number !== null) as any}
            onJoinBox={handleJoinBox}
            onLeaveBox={handleLeaveBox}
            numBoxes={12}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
