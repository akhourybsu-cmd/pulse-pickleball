import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toLocaleDateStringEST } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CourtMatch {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  team1_players: string[];
  team2_players: string[];
}

const CourtHistory = () => {
  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState<Array<{ id: string; name: string; city: string; state: string }>>([]);
  const [selectedCourt, setSelectedCourt] = useState("");
  const [matches, setMatches] = useState<CourtMatch[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourts();
  }, []);

  useEffect(() => {
    if (selectedCourt) {
      fetchCourtMatches();
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
            profiles(full_name)
          `)
          .eq("match_id", match.id);

        const team1 = participants?.filter(p => p.team === 1).map(p => p.profiles.full_name) || [];
        const team2 = participants?.filter(p => p.team === 2).map(p => p.profiles.full_name) || [];

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

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const selectedCourtData = courts.find(c => c.id === selectedCourt);

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

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Court Match History</h1>

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
    </div>
  );
};

export default CourtHistory;