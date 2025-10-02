import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface MatchTicket {
  id: string;
  session_id: string;
  court_number: number;
  status: string;
  team1_score: number | null;
  team2_score: number | null;
  team1_player1_id: string;
  team1_player2_id: string;
  team2_player1_id: string;
  team2_player2_id: string;
  team1_player1: {
    id: string;
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
  team1_player2: {
    id: string;
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
  team2_player1: {
    id: string;
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
  team2_player2: {
    id: string;
    display_name: string | null;
    full_name: string;
    current_rating: number;
  };
  sessions: {
    match_type: string;
    courts: {
      id: string;
      name: string;
    };
  };
}

export default function MatchTicket() {
  const { ticketId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<MatchTicket | null>(null);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkUser();
    fetchTicket();
  }, [ticketId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUserId(user.id);
  };

  const fetchTicket = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from("match_tickets")
        .select(`
          *,
          team1_player1:team1_player1_id (id, display_name, full_name, current_rating),
          team1_player2:team1_player2_id (id, display_name, full_name, current_rating),
          team2_player1:team2_player1_id (id, display_name, full_name, current_rating),
          team2_player2:team2_player2_id (id, display_name, full_name, current_rating),
          sessions:session_id (
            match_type,
            courts:court_id (id, name)
          )
        `)
        .eq("id", ticketId)
        .single();

      if (error) throw error;

      setTicket(data as any);
      
      if (data.team1_score !== null) {
        setTeam1Score(data.team1_score.toString());
      }
      if (data.team2_score !== null) {
        setTeam2Score(data.team2_score.toString());
      }
    } catch (error: any) {
      console.error("Error fetching ticket:", error);
      toast({
        title: "Error",
        description: "Failed to load match ticket",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitScore = async () => {
    if (!ticket || !userId) return;

    const t1Score = parseInt(team1Score);
    const t2Score = parseInt(team2Score);

    if (isNaN(t1Score) || isNaN(t2Score) || t1Score < 0 || t2Score < 0) {
      toast({
        title: "Invalid Scores",
        description: "Please enter valid scores",
        variant: "destructive",
      });
      return;
    }

    if (t1Score === t2Score) {
      toast({
        title: "Invalid Scores",
        description: "Match cannot end in a tie",
        variant: "destructive",
      });
      return;
    }

    // Check if user is in the match
    const isPlayerInMatch = [
      ticket.team1_player1_id,
      ticket.team1_player2_id,
      ticket.team2_player1_id,
      ticket.team2_player2_id,
    ].includes(userId);

    if (!isPlayerInMatch) {
      toast({
        title: "Not Authorized",
        description: "Only players in this match can submit scores",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Create match record
      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .insert({
          court_id: ticket.sessions.courts.id,
          match_date: new Date().toISOString().split('T')[0],
          team1_score: t1Score,
          team2_score: t2Score,
          match_type: ticket.sessions.match_type,
          status: "approved",
          created_by: userId,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Create match participants
      const participants = [
        {
          match_id: matchData.id,
          player_id: ticket.team1_player1_id,
          team: 1,
        },
        {
          match_id: matchData.id,
          player_id: ticket.team1_player2_id,
          team: 1,
        },
        {
          match_id: matchData.id,
          player_id: ticket.team2_player1_id,
          team: 2,
        },
        {
          match_id: matchData.id,
          player_id: ticket.team2_player2_id,
          team: 2,
        },
      ];

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      // Update ticket
      const { error: ticketError } = await supabase
        .from("match_tickets")
        .update({
          team1_score: t1Score,
          team2_score: t2Score,
          status: "completed",
          completed_at: new Date().toISOString(),
          match_id: matchData.id,
        })
        .eq("id", ticket.id);

      if (ticketError) throw ticketError;

      // Update queue entries - increment games played and set back to waiting
      const playerIds = [
        ticket.team1_player1_id,
        ticket.team1_player2_id,
        ticket.team2_player1_id,
        ticket.team2_player2_id,
      ];

      for (const playerId of playerIds) {
        const { data: currentEntry } = await supabase
          .from("queue_entries")
          .select("games_played")
          .eq("session_id", ticket.session_id)
          .eq("player_id", playerId)
          .single();

        if (currentEntry) {
          await supabase
            .from("queue_entries")
            .update({
              status: "waiting",
              games_played: currentEntry.games_played + 1,
            })
            .eq("session_id", ticket.session_id)
            .eq("player_id", playerId);
        }
      }

      toast({
        title: "Score Submitted!",
        description: "Match has been recorded and ratings will be updated",
      });

      navigate("/session/queue");
    } catch (error: any) {
      console.error("Error submitting score:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading match...</p>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="border-b bg-secondary/30">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate("/session/queue")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Queue
            </Button>
            <ThemeToggle />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Match Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                This match ticket could not be found.
              </p>
              <Button onClick={() => navigate("/session/queue")} className="w-full">
                Back to Queue
              </Button>
            </CardContent>
          </Card>
        </div>
        <Footer />
      </div>
    );
  }

  const isCompleted = ticket.status === "completed";
  const canSubmit = userId && [
    ticket.team1_player1_id,
    ticket.team1_player2_id,
    ticket.team2_player1_id,
    ticket.team2_player2_id,
  ].includes(userId);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/session/queue")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Queue
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Court {ticket.court_number}
              </CardTitle>
              <Badge variant={isCompleted ? "default" : "secondary"}>
                {ticket.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Team 1 */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Team 1</h3>
              <div className="space-y-1 pl-4">
                <p className="text-sm">
                  {ticket.team1_player1.display_name || ticket.team1_player1.full_name}
                  <span className="text-muted-foreground ml-2">
                    ({ticket.team1_player1.current_rating.toFixed(2)})
                  </span>
                </p>
                <p className="text-sm">
                  {ticket.team1_player2.display_name || ticket.team1_player2.full_name}
                  <span className="text-muted-foreground ml-2">
                    ({ticket.team1_player2.current_rating.toFixed(2)})
                  </span>
                </p>
              </div>
            </div>

            {/* Team 2 */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Team 2</h3>
              <div className="space-y-1 pl-4">
                <p className="text-sm">
                  {ticket.team2_player1.display_name || ticket.team2_player1.full_name}
                  <span className="text-muted-foreground ml-2">
                    ({ticket.team2_player1.current_rating.toFixed(2)})
                  </span>
                </p>
                <p className="text-sm">
                  {ticket.team2_player2.display_name || ticket.team2_player2.full_name}
                  <span className="text-muted-foreground ml-2">
                    ({ticket.team2_player2.current_rating.toFixed(2)})
                  </span>
                </p>
              </div>
            </div>

            {/* Score Entry */}
            {!isCompleted && canSubmit && (
              <div className="pt-4 border-t space-y-4">
                <h3 className="font-semibold">Enter Final Score</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="team1-score">Team 1 Score</Label>
                    <Input
                      id="team1-score"
                      type="number"
                      min="0"
                      value={team1Score}
                      onChange={(e) => setTeam1Score(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="team2-score">Team 2 Score</Label>
                    <Input
                      id="team2-score"
                      type="number"
                      min="0"
                      value={team2Score}
                      onChange={(e) => setTeam2Score(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
                <Button
                  onClick={handleSubmitScore}
                  disabled={submitting}
                  className="w-full"
                >
                  {submitting ? "Submitting..." : "Submit Score"}
                </Button>
              </div>
            )}

            {/* Final Score Display */}
            {isCompleted && (
              <div className="pt-4 border-t">
                <h3 className="font-semibold mb-2">Final Score</h3>
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {ticket.team1_score} - {ticket.team2_score}
                  </p>
                </div>
              </div>
            )}

            {!canSubmit && !isCompleted && (
              <p className="text-sm text-muted-foreground text-center">
                Only players in this match can submit the score
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}
