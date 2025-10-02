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
import { PlayerCombobox } from "@/components/PlayerCombobox";
import { z } from "zod";
import { ThemeToggle } from "@/components/ThemeToggle";

const matchSchema = z.object({
  matchDate: z.string().refine((date) => {
    const matchDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matchDate <= today;
  }, "Match date cannot be in the future"),
  team1Score: z.number().int().min(0, "Score must be non-negative").max(99, "Score too high"),
  team2Score: z.number().int().min(0, "Score must be non-negative").max(99, "Score too high"),
  players: z.array(z.string().uuid()).length(4, "Must select exactly 4 players"),
}).refine((data) => data.team1Score !== data.team2Score, {
  message: "Scores cannot be tied",
  path: ["team2Score"],
});

interface Profile {
  id: string;
  full_name: string;
  current_rating: number;
  week_start_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
}

const NewMatch = () => {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [courts, setCourts] = useState<Array<{ id: string; name: string; city: string; state: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  const [team1Player1, setTeam1Player1] = useState("");
  const [team1Player2, setTeam1Player2] = useState("");
  const [team2Player1, setTeam2Player1] = useState("");
  const [team2Player2, setTeam2Player2] = useState("");
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
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
        .select("id, full_name, current_rating, week_start_rating, total_matches, wins, losses")
        .order("full_name");

      if (profilesData) {
        setPlayers(profilesData);
        setTeam1Player1(user.id);
      }

      // Fetch courts
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, city, state")
        .order("name");

      if (courtsData) {
        setCourts(courtsData);
        if (courtsData.length > 0) {
          setSelectedCourt(courtsData[0].id);
        }
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

      // Validate input
      const validationResult = matchSchema.safeParse({
        matchDate,
        team1Score: score1,
        team2Score: score2,
        players: selectedPlayers,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
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
          court_id: selectedCourt,
          status: 'approved',
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Create minimal participant records - ratings will be calculated by recompute function
      const participants = [
        {
          match_id: matchData.id,
          player_id: team1Player1,
          team: 1,
        },
        {
          match_id: matchData.id,
          player_id: team1Player2,
          team: 1,
        },
        {
          match_id: matchData.id,
          player_id: team2Player1,
          team: 2,
        },
        {
          match_id: matchData.id,
          player_id: team2Player2,
          team: 2,
        },
      ];

      const { error: participantsError } = await supabase
        .from("match_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      // Get the week_start for this match and trigger recomputation from that week
      // Recalculate all ratings (handles new match and any backfill)
      await supabase.rpc('recalculate_all_ratings');

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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
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

              <div className="space-y-2">
                <Label htmlFor="court">Court Location</Label>
                <Select value={selectedCourt} onValueChange={setSelectedCourt} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name} - {court.city}, {court.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-primary">Team 1</h3>
                
                <div className="space-y-2">
                  <Label>Player 1</Label>
                  <PlayerCombobox
                    players={players}
                    value={team1Player1}
                    onValueChange={setTeam1Player1}
                    placeholder="Search player..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Player 2</Label>
                  <PlayerCombobox
                    players={players}
                    value={team1Player2}
                    onValueChange={setTeam1Player2}
                    placeholder="Search player..."
                  />
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
                  <PlayerCombobox
                    players={players}
                    value={team2Player1}
                    onValueChange={setTeam2Player1}
                    placeholder="Search player..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Player 2</Label>
                  <PlayerCombobox
                    players={players}
                    value={team2Player2}
                    onValueChange={setTeam2Player2}
                    placeholder="Search player..."
                  />
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
