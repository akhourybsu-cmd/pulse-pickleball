import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Medal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toLocaleDateStringEST } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface CourtMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  team1_players: string[];
  team2_players: string[];
}

interface LeaderboardEntry {
  player_id: string;
  player_name: string;
  wins: number;
}

const CourtHistory = () => {
  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState<Array<{ id: string; name: string; city: string; state: string }>>([]);
  const [selectedCourt, setSelectedCourt] = useState("");
  const [matches, setMatches] = useState<CourtMatch[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    if (selectedCourt) {
      fetchCourtMatches();
      fetchWeeklyLeaderboard();
    }
  }, [selectedCourt]);

  const fetchCourts = async () => {
    const { data } = await supabase
      .from("courts")
      .select("id, name, city, state")
      .order("name");

    if (data) {
      setCourts(data);
      if (data.length > 0) {
        setSelectedCourt(data[0].id);
      }
    }
    setLoading(false);
  };

  const fetchCourtMatches = async () => {
    const { data: matchesData } = await supabase
      .from("matches")
      .select("id, match_date, team1_score, team2_score, status")
      .eq("court_id", selectedCourt)
      .eq("status", "approved")
      .order("match_date", { ascending: false });

    if (!matchesData) {
      setMatches([]);
      return;
    }

    const matchesWithPlayers = await Promise.all(
      matchesData.map(async (match) => {
        const { data: participants } = await supabase
          .from("match_participants")
          .select(`
            team,
            profiles(full_name, display_name)
          `)
          .eq("match_id", match.id);

        const team1 = participants?.filter(p => p.team === 1).map(p => p.profiles.display_name || p.profiles.full_name) || [];
        const team2 = participants?.filter(p => p.team === 2).map(p => p.profiles.display_name || p.profiles.full_name) || [];

        return {
          match_id: match.id,
          match_date: match.match_date,
          team1_score: match.team1_score,
          team2_score: match.team2_score,
          team1_players: team1,
          team2_players: team2,
        };
      })
    );

    setMatches(matchesWithPlayers);
  };

  const fetchWeeklyLeaderboard = async () => {
    if (!selectedCourt) return;

    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diff);
    weekStart.setHours(0, 0, 0, 0);

    const { data: matchesData } = await supabase
      .from("matches")
      .select(`
        id,
        match_date,
        team1_score,
        team2_score
      `)
      .eq("court_id", selectedCourt)
      .eq("status", "approved")
      .gte("match_date", weekStart.toISOString().split('T')[0]);

    if (!matchesData || matchesData.length === 0) {
      setLeaderboard([]);
      return;
    }

    // Get participants for these matches
    const winsMap = new Map<string, { name: string; wins: number }>();
    
    for (const match of matchesData) {
      const { data: participants } = await supabase
        .from("match_participants")
        .select(`
          player_id,
          team,
          rating_change,
          profiles(full_name, display_name)
        `)
        .eq("match_id", match.id);

      if (participants) {
        participants.forEach((participant: any) => {
          const playerId = participant.player_id;
          const playerName = participant.profiles.display_name || participant.profiles.full_name;
          const won = participant.rating_change > 0;

          if (!winsMap.has(playerId)) {
            winsMap.set(playerId, { name: playerName, wins: 0 });
          }

          if (won) {
            winsMap.get(playerId)!.wins += 1;
          }
        });
      }
    }

    // Convert to array and sort
    const leaderboardData: LeaderboardEntry[] = Array.from(winsMap.entries())
      .map(([player_id, data]) => ({
        player_id,
        player_name: data.name,
        wins: data.wins,
      }))
      .filter(entry => entry.wins > 0) // Only show players with at least 1 win
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 3);

    setLeaderboard(leaderboardData);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const selectedCourtData = courts.find(c => c.id === selectedCourt);

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
        <h1 className="text-3xl font-bold mb-6">Court Match History</h1>

        {leaderboard.length > 0 && (
          <Card className="border-2 border-primary shadow-lg mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="w-5 h-5 text-primary" />
                This Week's Top Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.player_id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background">
                      {index === 0 && <span className="text-2xl">🥇</span>}
                      {index === 1 && <span className="text-2xl">🥈</span>}
                      {index === 2 && <span className="text-2xl">🥉</span>}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">{entry.player_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {entry.wins} {entry.wins === 1 ? 'win' : 'wins'} this week
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <Select value={selectedCourt} onValueChange={setSelectedCourt}>
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

        {selectedCourtData && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{selectedCourtData.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedCourtData.city}, {selectedCourtData.state}
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-lg">
                Total Matches: <span className="font-bold">{matches.length}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {matches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No matches recorded at this court yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.match_id}>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {toLocaleDateStringEST(match.match_date)}
                    </p>
                    <Badge>
                      {match.team1_score} - {match.team2_score}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="font-semibold text-sm text-primary mb-1">Team 1</p>
                      {match.team1_players.map((player, i) => (
                        <p key={i} className="text-sm">{player}</p>
                      ))}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm text-secondary mb-1">Team 2</p>
                      {match.team2_players.map((player, i) => (
                        <p key={i} className="text-sm">{player}</p>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default CourtHistory;