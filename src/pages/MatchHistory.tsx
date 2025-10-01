import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Match {
  match_id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  my_team: number;
  partner_name: string;
  opponent1_name: string;
  opponent2_name: string;
  rating_change: number;
  rating_after: number;
  court_name: string;
  won: boolean;
}

const MatchHistory = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const playerId = searchParams.get("player");

  useEffect(() => {
    fetchMatchHistory();
  }, [playerId]);

  const fetchMatchHistory = async () => {
    const playerIdToUse = playerId || (await supabase.auth.getUser()).data.user?.id;
    if (!playerIdToUse) {
      navigate("/auth");
      return;
    }

    // Get player name
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", playerIdToUse)
      .single();

    setPlayerName(profile?.full_name || "Player");

    // Get all approved matches for this player
    const { data: participantsData } = await supabase
      .from("match_participants")
      .select(`
        match_id,
        team,
        rating_change,
        rating_after,
        matches!inner(
          match_date,
          team1_score,
          team2_score,
          status,
          court_id,
          courts(name)
        )
      `)
      .eq("player_id", playerIdToUse)
      .eq("matches.status", "approved")
      .order("matches(match_date)", { ascending: false });

    if (!participantsData) {
      setLoading(false);
      return;
    }

    // Get details for each match
    const matchesWithDetails = await Promise.all(
      participantsData.map(async (p: any) => {
        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select(`
            player_id,
            team,
            profiles(full_name)
          `)
          .eq("match_id", p.match_id);

        const myTeam = p.team;
        const teammates = allParticipants?.filter(
          part => part.team === myTeam && part.player_id !== playerIdToUse
        );
        const opponents = allParticipants?.filter(part => part.team !== myTeam);

        const won = p.rating_change > 0;

        return {
          match_id: p.match_id,
          match_date: p.matches.match_date,
          team1_score: p.matches.team1_score,
          team2_score: p.matches.team2_score,
          my_team: myTeam,
          partner_name: teammates?.[0]?.profiles?.full_name || "Unknown",
          opponent1_name: opponents?.[0]?.profiles?.full_name || "Unknown",
          opponent2_name: opponents?.[1]?.profiles?.full_name || "Unknown",
          rating_change: p.rating_change,
          rating_after: p.rating_after,
          court_name: p.matches.courts?.name || "Unknown Court",
          won,
        };
      })
    );

    setMatches(matchesWithDetails);
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

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
        <h1 className="text-3xl font-bold mb-6">Match History - {playerName}</h1>

        {matches.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No match history yet
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => (
              <Card key={match.match_id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{match.court_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {new Date(match.match_date).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={match.won ? "default" : "destructive"}>
                      {match.won ? "Won" : "Lost"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="text-sm font-semibold">Your Team</p>
                      <p className="text-sm">{playerName}</p>
                      <p className="text-sm">{match.partner_name}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">
                        {match.my_team === 1 ? match.team1_score : match.team2_score}
                        {" - "}
                        {match.my_team === 1 ? match.team2_score : match.team1_score}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">Opponents</p>
                      <p className="text-sm">{match.opponent1_name}</p>
                      <p className="text-sm">{match.opponent2_name}</p>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 text-sm border-t">
                    <span>Rating Change:</span>
                    <span className={match.rating_change > 0 ? "text-green-600" : "text-red-600"}>
                      {match.rating_change > 0 ? "+" : ""}
                      {match.rating_change.toFixed(3)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Rating After:</span>
                    <span className="font-semibold">{match.rating_after.toFixed(2)}</span>
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

export default MatchHistory;