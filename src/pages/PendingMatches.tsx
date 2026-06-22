import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { resolvePlayerName, didTeamWin } from "@/lib/matchDisplay";

interface Participant {
  id: string;
  name: string;
  avatar_url: string | null;
  team: number;
}

interface PendingMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  court_name: string;
  source: string | null;
  round_no: number | null;
  court_no: number | null;
  my_team: 1 | 2;
  partner: Participant | null;
  opponent1: Participant | null;
  opponent2: Participant | null;
  my_approval: boolean | null;
  total_approvals: number;
  total_players: number;
  me: { name: string; avatar_url: string | null };
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

    const { data: participantsData } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        team,
        matches!inner(
          id,
          match_date,
          team1_score,
          team2_score,
          status,
          source,
          round_no,
          court_no,
          court_id,
          other_location,
          courts(name)
        )
      `)
      .eq("player_id", user.id)
      .eq("matches.status", "pending");

    if (!participantsData) {
      setLoading(false);
      return;
    }

    const matchesWithDetails = await Promise.all(
      participantsData.map(async (p: any) => {
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            profiles(id, display_name, full_name, first_name, last_name, avatar_url)
          `)
          .eq("match_id", p.match_id);

        const { data: approvals } = await supabase
          .from("match_approvals")
          .select("player_id, approved")
          .eq("match_id", p.match_id);

        const myTeam = p.team as 1 | 2;
        const parts = allParticipants || [];

        const toParticipant = (row: any): Participant => ({
          id: row.profiles?.id || row.player_id,
          name: resolvePlayerName(row.profiles),
          avatar_url: row.profiles?.avatar_url || null,
          team: row.team,
        });

        const meRow = parts.find((r: any) => r.player_id === user.id);
        const teammate = parts.find((r: any) => r.team === myTeam && r.player_id !== user.id);
        const opps = parts.filter((r: any) => r.team !== myTeam);

        return {
          match_id: p.match_id,
          match_date: p.matches.match_date,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          court_name: p.matches.other_location || p.matches.courts?.name || "Unknown Location",
          source: p.matches.source ?? null,
          round_no: p.matches.round_no ?? null,
          court_no: p.matches.court_no ?? null,
          my_team: myTeam,
          partner: teammate ? toParticipant(teammate) : null,
          opponent1: opps[0] ? toParticipant(opps[0]) : null,
          opponent2: opps[1] ? toParticipant(opps[1]) : null,
          my_approval: approvals?.find(a => a.player_id === user.id)?.approved ?? null,
          total_approvals: approvals?.filter(a => a.approved === true).length || 0,
          total_players: parts.length || 4,
          me: {
            name: meRow ? resolvePlayerName(meRow.profiles) : "You",
            avatar_url: meRow?.profiles?.avatar_url || null,
          },
        } as PendingMatch;
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

      const { data: allApprovals } = await supabase
        .from("match_approvals")
        .select("approved")
        .eq("match_id", matchId);

      const allApproved = allApprovals?.every(a => a.approved === true);
      const anyRejected = allApprovals?.some(a => a.approved === false);

      if (allApproved) {
        await finalizeMatch(matchId);
      } else if (anyRejected) {
        await supabase
          .from("matches")
          .update({ status: "rejected" })
          .eq("id", matchId);
      }

      toast.success(approved ? "Match confirmed!" : "Match disputed");
      fetchPendingMatches();
    } catch (error: any) {
      toast.error(error.message || "Failed to update approval");
    }
  };

  const finalizeMatch = async (matchId: string) => {
    await supabase
      .from("matches")
      .update({ status: "approved" })
      .eq("id", matchId);

    const { data: participants } = await supabase
      .from("match_participants")
      .select("*")
      .eq("match_id", matchId);

    const { data: match } = await supabase
      .from("matches")
      .select("team1_score, team2_score")
      .eq("id", matchId)
      .single();

    if (!participants || !match) return;

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
          <div className="space-y-3">
            {matches.map((match) => (
              <div key={match.match_id} className="space-y-2">
                <PremiumMatchCard
                  matchId={match.match_id}
                  matchDate={match.match_date}
                  team1Score={match.team1_score}
                  team2Score={match.team2_score}
                  myTeam={match.my_team}
                  won={didTeamWin(match.my_team, match.team1_score, match.team2_score)}
                  playerName={match.me.name}
                  playerAvatarUrl={match.me.avatar_url}
                  partnerName={match.partner?.name || ""}
                  partnerId={match.partner?.id || ""}
                  partnerAvatarUrl={match.partner?.avatar_url || null}
                  opponent1Name={match.opponent1?.name || ""}
                  opponent1Id={match.opponent1?.id || ""}
                  opponent1AvatarUrl={match.opponent1?.avatar_url || null}
                  opponent2Name={match.opponent2?.name || ""}
                  opponent2Id={match.opponent2?.id || ""}
                  opponent2AvatarUrl={match.opponent2?.avatar_url || null}
                  ratingChange={null}
                  courtName={match.court_name}
                  source={match.source}
                  roundNo={match.round_no}
                  courtNo={match.court_no}
                  verifiedCount={match.total_approvals}
                  totalPlayers={match.total_players}
                  isCurrentUserVerified={match.my_approval === true}
                  showVerifyActions={false}
                  pending
                  pendingConfirmedByMe={match.my_approval === true}
                  onConfirm={() => handleApproval(match.match_id, true)}
                  perspective="self"
                />
                {match.my_approval === null && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleApproval(match.match_id, false)}
                      className="text-xs text-muted-foreground hover:text-destructive underline-offset-2 hover:underline transition-colors"
                    >
                      Dispute this result
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default PendingMatches;
