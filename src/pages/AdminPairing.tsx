import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shuffle, Users } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

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

interface Session {
  id: string;
  name: string;
  num_courts: number;
}

export default function AdminPairing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      toast({
        title: "Access Denied",
        description: "You don't have admin access",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    setIsAdmin(true);
    if (sessionId) {
      await fetchSessionData();
    }
    setLoading(false);
  };

  const fetchSessionData = async () => {
    if (!sessionId) return;

    const { data: sessionData } = await supabase
      .from("sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionData) {
      setSession(sessionData);
    }

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
    }
  };

  const generateBalancedPairings = () => {
    if (queueEntries.length < 4) {
      toast({
        title: "Not Enough Players",
        description: "Need at least 4 players in queue",
        variant: "destructive",
      });
      return [];
    }

    // Sort by rating
    const sorted = [...queueEntries].sort((a, b) => 
      b.profiles.current_rating - a.profiles.current_rating
    );

    const matches: Array<{
      team1: [QueueEntry, QueueEntry];
      team2: [QueueEntry, QueueEntry];
      balance: number;
    }> = [];

    const numCourts = session?.num_courts || 3;
    const playersPerMatch = 4;
    const maxMatches = Math.min(
      numCourts,
      Math.floor(sorted.length / playersPerMatch)
    );

    // Simple balanced pairing: snake draft style
    for (let i = 0; i < maxMatches; i++) {
      const baseIdx = i * 4;
      if (baseIdx + 3 >= sorted.length) break;

      // Pairing pattern: 1,4 vs 2,3 (balanced)
      const team1 = [sorted[baseIdx], sorted[baseIdx + 3]];
      const team2 = [sorted[baseIdx + 1], sorted[baseIdx + 2]];

      const team1Avg = (team1[0].profiles.current_rating + team1[1].profiles.current_rating) / 2;
      const team2Avg = (team2[0].profiles.current_rating + team2[1].profiles.current_rating) / 2;
      const balance = Math.abs(team1Avg - team2Avg);

      matches.push({
        team1: team1 as [QueueEntry, QueueEntry],
        team2: team2 as [QueueEntry, QueueEntry],
        balance,
      });
    }

    return matches;
  };

  const handleGeneratePairings = async () => {
    if (!session || !sessionId) return;

    setGenerating(true);

    try {
      const pairings = generateBalancedPairings();

      if (pairings.length === 0) {
        toast({
          title: "No Pairings Generated",
          description: "Not enough players for matches",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      // Check for court conflicts
      const { data: existingTickets } = await supabase
        .from("match_tickets")
        .select("court_number")
        .eq("session_id", sessionId)
        .in("status", ["live", "on-deck"]);

      const usedCourts = new Set(existingTickets?.map(t => t.court_number) || []);
      
      // Create match tickets with available courts only
      const tickets = pairings
        .filter((_, idx) => !usedCourts.has(idx + 1))
        .map((pairing, idx) => {
          // Find next available court
          let courtNum = idx + 1;
          while (usedCourts.has(courtNum) && courtNum <= session.num_courts) {
            courtNum++;
          }
          
          return {
            session_id: sessionId,
            court_number: courtNum,
            team1_player1_id: pairing.team1[0].player_id,
            team1_player2_id: pairing.team1[1].player_id,
            team2_player1_id: pairing.team2[0].player_id,
            team2_player2_id: pairing.team2[1].player_id,
            status: idx === 0 ? "live" : "on-deck",
          };
        })
        .filter(t => t.court_number <= session.num_courts);

      if (tickets.length === 0) {
        toast({
          title: "No Courts Available",
          description: "All courts are currently in use",
          variant: "destructive",
        });
        setGenerating(false);
        return;
      }

      const { error } = await supabase
        .from("match_tickets")
        .insert(tickets);

      if (error) throw error;

      // Update queue entries to 'playing'
      const playerIds = tickets.flatMap(t => [
        t.team1_player1_id,
        t.team1_player2_id,
        t.team2_player1_id,
        t.team2_player2_id,
      ]);

      await supabase
        .from("queue_entries")
        .update({ status: "playing" })
        .eq("session_id", sessionId)
        .in("player_id", playerIds);

      toast({
        title: "Pairings Generated!",
        description: `Created ${tickets.length} match${tickets.length !== 1 ? 'es' : ''}`,
      });

      navigate(`/session/queue`);
    } catch (error: any) {
      console.error("Error generating pairings:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin || !session) {
    return null;
  }

  const pairings = useMemo(() => generateBalancedPairings(), [queueEntries, session]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin/session")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Generate Pairings</h1>
          <Badge variant="secondary">
            <Users className="mr-2 h-4 w-4" />
            {queueEntries.length} in queue
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{session.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Available courts: {session.num_courts}
            </p>
            <Button
              onClick={handleGeneratePairings}
              disabled={generating || pairings.length === 0}
              className="w-full"
            >
              <Shuffle className="mr-2 h-4 w-4" />
              {generating ? "Generating..." : `Generate ${pairings.length} Match${pairings.length !== 1 ? 'es' : ''}`}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Pairings */}
        {pairings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Proposed Matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pairings.map((pairing, idx) => {
                const team1Avg = (pairing.team1[0].profiles.current_rating + pairing.team1[1].profiles.current_rating) / 2;
                const team2Avg = (pairing.team2[0].profiles.current_rating + pairing.team2[1].profiles.current_rating) / 2;

                return (
                  <div key={idx} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Court {idx + 1}</p>
                      <Badge variant="outline">
                        Balance: ±{pairing.balance.toFixed(2)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium mb-1">
                          Team 1 <span className="text-muted-foreground">({team1Avg.toFixed(2)})</span>
                        </p>
                        <p>{pairing.team1[0].profiles.display_name || pairing.team1[0].profiles.full_name}</p>
                        <p>{pairing.team1[1].profiles.display_name || pairing.team1[1].profiles.full_name}</p>
                      </div>
                      <div>
                        <p className="font-medium mb-1">
                          Team 2 <span className="text-muted-foreground">({team2Avg.toFixed(2)})</span>
                        </p>
                        <p>{pairing.team2[0].profiles.display_name || pairing.team2[0].profiles.full_name}</p>
                        <p>{pairing.team2[1].profiles.display_name || pairing.team2[1].profiles.full_name}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {pairings.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Not enough players in queue to generate matches
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}
