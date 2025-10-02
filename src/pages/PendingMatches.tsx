import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toLocaleDateStringEST } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";

interface PendingMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  team1_players: string[];
  team2_players: string[];
  court_name: string;
  my_approval: boolean | null;
  total_approvals: number;
}

const PendingMatches = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<PendingMatch[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchPendingMatches();
  }, []);

  const fetchPendingMatches = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);

    // Get all matches where user is a participant and status is pending
    const { data: participantsData } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        matches!inner(
          match_date,
          team1_score,
          team2_score,
          status,
          court_id,
          courts(name)
        )
      `)
      .eq("player_id", user.id)
      .eq("matches.status", "pending");

    if (!participantsData) {
      setLoading(false);
      return;
    }

    // For each match, get all participants and approval status
    const matchesWithDetails = await Promise.all(
      participantsData.map(async (p: any) => {
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            profiles(full_name, display_name)
          `)
          .eq("match_id", p.match_id);

        const { data: approvals } = await supabase
          .from("match_approvals")
          .select("player_id, approved")
          .eq("match_id", p.match_id);

        const team1 = allParticipants?.filter(p => p.team === 1).map(p => p.profiles.display_name || p.profiles.full_name) || [];
        const team2 = allParticipants?.filter(p => p.team === 2).map(p => p.profiles.display_name || p.profiles.full_name) || [];
        const myApproval = approvals?.find(a => a.player_id === user.id)?.approved;
        const totalApprovals = approvals?.filter(a => a.approved === true).length || 0;

        return {
          match_id: p.match_id,
          match_date: p.matches.match_date,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          team1_players: team1,
          team2_players: team2,
          court_name: p.matches.courts?.name || "Unknown Court",
          my_approval: myApproval,
          total_approvals: totalApprovals,
        };
      })
    );

    setMatches(matchesWithDetails);
    setLoading(false);
  };

  const handleApproval = async (matchId: string, approved: boolean) => {
    try {
      const { error } = await supabase
        .from("match_approvals")
        .update({
          approved,
          approved_at: new Date().toISOString()
        })
        .eq("match_id", matchId)
        .eq("player_id", currentUserId);

      if (error) throw error;

      // Check if all players have approved
      const { data: allApprovals } = await supabase
        .from("match_approvals")
        .select("approved")
        .eq("match_id", matchId);

      const allApproved = allApprovals?.every(a => a.approved === true);
      const anyRejected = allApprovals?.some(a => a.approved === false);

      if (allApproved) {
        // Update match status and apply rating changes
        await finalizeMatch(matchId);
      } else if (anyRejected) {
        // Mark match as rejected
        await supabase
          .from("matches")
          .update({ status: "rejected" })
          .eq("id", matchId);
      }

      toast.success(approved ? "Match approved!" : "Match rejected");
      fetchPendingMatches();
    } catch (error: any) {
      toast.error(error.message || "Failed to update approval");
    }
  };

  const finalizeMatch = async (matchId: string) => {
    // Update match status
    await supabase
      .from("matches")
      .update({ status: "approved" })
      .eq("id", matchId);

    // Get all participants with their rating changes
    const { data: participants } = await supabase
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId);

    // Get match details for analytics
    const { data: match } = await supabase
      .from("matches")
      .select("team1_score, team2_score")
      .eq("id", matchId)
      .single();

    if (!participants || !match) return;

    // Update each player's profile with final ratings and stats
    for (const participant of participants) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", participant.player_id)
        .single();

      if (profile) {
        const isWinner = participant.rating_change > 0;
        const pointsFor = participant.team === 1 ? match.team1_score : match.team2_score;
        const pointsAgainst = participant.team === 1 ? match.team2_score : match.team1_score;

        await supabase
          .from("profiles")
          .update({
            current_rating: participant.rating_after,
            total_matches: profile.total_matches + 1,
            wins: isWinner ? profile.wins + 1 : profile.wins,
            losses: !isWinner ? profile.losses + 1 : profile.losses,
            total_points_for: profile.total_points_for + pointsFor,
            total_points_against: profile.total_points_against + pointsAgainst,
          })
          .eq("id", participant.player_id);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Pending Match Approvals</h1>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No pending matches to approve
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.match_id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{match.court_name}</CardTitle>
                      <CardDescription>
                        {toLocaleDateStringEST(match.match_date)}
                      </CardDescription>
                    </div>
                    <Badge variant={match.my_approval === true ? "default" : "secondary"}>
                      {match.total_approvals}/4 Approved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="font-semibold text-primary">Team 1</p>
                      {match.team1_players.map((p, i) => (
                        <p key={i} className="text-sm">{p}</p>
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold">
                        {match.team1_score} - {match.team2_score}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-secondary">Team 2</p>
                      {match.team2_players.map((p, i) => (
                        <p key={i} className="text-sm">{p}</p>
                      ))}
                    </div>
                  </div>

                  {match.my_approval === null && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={() => handleApproval(match.match_id, true)}
                        className="flex-1"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleApproval(match.match_id, false)}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}

                  {match.my_approval === true && (
                    <p className="text-center text-sm text-muted-foreground pt-4">
                      ✓ You've approved this match
                    </p>
                  )}

                  {match.my_approval === false && (
                    <p className="text-center text-sm text-destructive pt-4">
                      ✗ You've rejected this match
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PendingMatches;