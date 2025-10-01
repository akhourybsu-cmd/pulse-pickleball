import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
  current_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
}

const NewMatch = () => {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [team1Player1, setTeam1Player1] = useState("");
  const [team1Player2, setTeam1Player2] = useState("");
  const [team2Player1, setTeam2Player1] = useState("");
  const [team2Player2, setTeam2Player2] = useState("");
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, current_rating, total_matches, wins, losses")
        .order("full_name");

      if (profilesData) {
        setPlayers(profilesData);
        setTeam1Player1(user.id);
      }
    };

    fetchData();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];
      const uniquePlayers = new Set(selectedPlayers);
      
      if (uniquePlayers.size !== 4) {
        toast.error("Please select 4 different players");
        setLoading(false);
        return;
      }

      const score1 = parseInt(team1Score);
      const score2 = parseInt(team2Score);

      if (score1 === score2) {
        toast.error("Scores cannot be tied");
        setLoading(false);
        return;
      }

      const { data: matchData, error: matchError } = await supabase
        .from("matches")
        .insert({
          match_date: matchDate,
          team1_score: score1,
          team2_score: score2,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      const team1Won = score1 > score2;

      // Get full player profiles
      const getPlayer = (playerId: string) => 
        players.find((p) => p.id === playerId)!;
      
      const t1p1 = getPlayer(team1Player1);
      const t1p2 = getPlayer(team1Player2);
      const t2p1 = getPlayer(team2Player1);
      const t2p2 = getPlayer(team2Player2);

      // Get clamping parameters
      const { data: params } = await supabase
        .from('rating_parameters')
        .select('clamp_min, clamp_max')
        .single();
      
      const clampMin = params?.clamp_min || 2.0;
      const clampMax = params?.clamp_max || 4.5;
      const clampRating = (rating: number) => 
        Math.max(clampMin, Math.min(clampMax, rating));

      // Calculate individual rating changes using PULSE algorithm
      const calculateChange = async (
        playerRating: number,
        partnerRating: number,
        opp1Rating: number,
        opp2Rating: number,
        teamScore: number,
        oppScore: number,
        won: boolean,
        playerMatches: number
      ) => {
        const { data, error } = await supabase.rpc(
          'calculate_pulse_rating_change',
          {
            p_player_rating: playerRating,
            p_partner_rating: partnerRating,
            p_opponent1_rating: opp1Rating,
            p_opponent2_rating: opp2Rating,
            p_team_score: teamScore,
            p_opponent_score: oppScore,
            p_won: won,
            p_match_type: 'league',
            p_player_matches: playerMatches
          }
        );
        if (error) throw error;
        return data as number;
      };

      const t1p1Change = await calculateChange(
        t1p1.current_rating, t1p2.current_rating,
        t2p1.current_rating, t2p2.current_rating,
        score1, score2, team1Won, t1p1.total_matches
      );

      const t1p2Change = await calculateChange(
        t1p2.current_rating, t1p1.current_rating,
        t2p1.current_rating, t2p2.current_rating,
        score1, score2, team1Won, t1p2.total_matches
      );

      const t2p1Change = await calculateChange(
        t2p1.current_rating, t2p2.current_rating,
        t1p1.current_rating, t1p2.current_rating,
        score2, score1, !team1Won, t2p1.total_matches
      );

      const t2p2Change = await calculateChange(
        t2p2.current_rating, t2p1.current_rating,
        t1p1.current_rating, t1p2.current_rating,
        score2, score1, !team1Won, t2p2.total_matches
      );

      const participants = [
        {
          match_id: matchData.id,
          player_id: team1Player1,
          team: 1,
          rating_before: t1p1.current_rating,
          rating_after: clampRating(t1p1.current_rating + t1p1Change),
          rating_change: t1p1Change,
        },
        {
          match_id: matchData.id,
          player_id: team1Player2,
          team: 1,
          rating_before: t1p2.current_rating,
          rating_after: clampRating(t1p2.current_rating + t1p2Change),
          rating_change: t1p2Change,
        },
        {
          match_id: matchData.id,
          player_id: team2Player1,
          team: 2,
          rating_before: t2p1.current_rating,
          rating_after: clampRating(t2p1.current_rating + t2p1Change),
          rating_change: t2p1Change,
        },
        {
          match_id: matchData.id,
          player_id: team2Player2,
          team: 2,
          rating_before: t2p2.current_rating,
          rating_after: clampRating(t2p2.current_rating + t2p2Change),
          rating_change: t2p2Change,
        },
      ];

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      for (const participant of participants) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("total_matches, wins, losses")
          .eq("id", participant.player_id)
          .single();

        if (currentProfile) {
          await supabase
            .from("profiles")
            .update({
              current_rating: participant.rating_after,
              total_matches: currentProfile.total_matches + 1,
              wins: participant.rating_change > 0 ? currentProfile.wins + 1 : currentProfile.wins,
              losses: participant.rating_change < 0 ? currentProfile.losses + 1 : currentProfile.losses,
            })
            .eq("id", participant.player_id);
        }
      }

      toast.success("Match recorded successfully!");
      navigate("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to record match");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Record New Match</CardTitle>
            <CardDescription>
              Enter the details of your doubles match
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="matchDate">Match Date</Label>
                <Input
                  id="matchDate"
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-primary">Team 1</h3>
                
                <div className="space-y-2">
                  <Label>Player 1</Label>
                  <Select value={team1Player1} onValueChange={setTeam1Player1} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name} ({player.current_rating.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Player 2</Label>
                  <Select value={team1Player2} onValueChange={setTeam1Player2} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name} ({player.current_rating.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team1Score">Team 1 Score</Label>
                  <Input
                    id="team1Score"
                    type="number"
                    min="0"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-secondary">Team 2</h3>
                
                <div className="space-y-2">
                  <Label>Player 1</Label>
                  <Select value={team2Player1} onValueChange={setTeam2Player1} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name} ({player.current_rating.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Player 2</Label>
                  <Select value={team2Player2} onValueChange={setTeam2Player2} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select player" />
                    </SelectTrigger>
                    <SelectContent>
                      {players.map((player) => (
                        <SelectItem key={player.id} value={player.id}>
                          {player.full_name} ({player.current_rating.toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team2Score">Team 2 Score</Label>
                  <Input
                    id="team2Score"
                    type="number"
                    min="0"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Recording..." : "Record Match"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NewMatch;
