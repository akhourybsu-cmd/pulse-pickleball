import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Trophy, MapPin } from "lucide-react";
import { ScoreEntryDialog } from "./ScoreEntryDialog";
import { CourtAssignmentDialog } from "./CourtAssignmentDialog";

interface Match {
  id: string;
  round_number: number;
  match_number: number;
  status: string;
  team1_score: number | null;
  team2_score: number | null;
  team1_id: string;
  team2_id: string;
  division_id: string;
  team1: { team_name: string };
  team2: { team_name: string };
  court: { court_number: number; court_name: string | null } | null;
  tournaments_divisions: {
    event_id: string;
    tournaments_scoring_rulesets: {
      games_to: number;
      win_by_2: boolean;
      best_of: number;
    } | null;
  };
}

interface MatchesPanelProps {
  divisionId: string;
  refreshKey?: number;
}

export function MatchesPanel({ divisionId, refreshKey }: MatchesPanelProps) {
  const { toast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isScoreDialogOpen, setIsScoreDialogOpen] = useState(false);
  const [isCourtDialogOpen, setIsCourtDialogOpen] = useState(false);
  const [eventId, setEventId] = useState<string>("");

  useEffect(() => {
    fetchMatches();
  }, [divisionId, refreshKey]);

  const fetchMatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_matches")
      .select(`
        *,
        team1:tournaments_teams!tournaments_matches_team1_id_fkey(team_name),
        team2:tournaments_teams!tournaments_matches_team2_id_fkey(team_name),
        court:tournaments_courts(court_number, court_name),
        tournaments_divisions(
          event_id,
          tournaments_scoring_rulesets(games_to, win_by_2, best_of)
        )
      `)
      .eq("division_id", divisionId)
      .order("match_number");

    if (!error && data && data.length > 0) {
      setEventId(data[0].tournaments_divisions.event_id);
    }

    if (error) {
      toast({
        title: "Error loading matches",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setMatches(data || []);
    }
    setLoading(false);
  };

  const handleStartMatch = async (match: Match) => {
    const { error } = await supabase
      .from("tournaments_matches")
      .update({
        status: "in_progress",
        started_at: new Date().toISOString(),
      })
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error starting match",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Match started",
        description: `${match.team1.team_name} vs ${match.team2.team_name}`,
      });
      fetchMatches();
    }
  };

  const handleEnterScore = (match: Match) => {
    setSelectedMatch(match);
    setIsScoreDialogOpen(true);
  };

  const handleAssignCourt = (match: Match) => {
    setSelectedMatch(match);
    setIsCourtDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      scheduled: "outline",
      in_progress: "default",
      completed: "secondary",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="capitalize">
        {status.replace("_", " ")}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Matches ({matches.length})</CardTitle>
          <CardDescription>Round robin match schedule</CardDescription>
        </CardHeader>
        <CardContent>
        {matches.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No matches generated yet. Click "Generate Matches" to create round robin schedule.
          </p>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => (
              <div
                key={match.id}
                className="flex items-center justify-between p-4 border rounded-lg gap-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline" className="font-mono">
                      Match {match.match_number}
                    </Badge>
                    {match.court && (
                      <Badge variant="secondary">
                        Court {match.court.court_number}
                        {match.court.court_name && ` (${match.court.court_name})`}
                      </Badge>
                    )}
                    {getStatusBadge(match.status)}
                  </div>
                  <div className="font-medium">
                    {match.team1.team_name} vs {match.team2.team_name}
                  </div>
                  {match.team1_score !== null && match.team2_score !== null && (
                    <div className="text-sm text-muted-foreground mt-1">
                      Score: {match.team1_score} - {match.team2_score}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {match.status === "scheduled" && !match.court && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAssignCourt(match)}
                    >
                      <MapPin className="h-4 w-4 mr-1" />
                      Assign Court
                    </Button>
                  )}
                  {match.status === "scheduled" && match.court && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleStartMatch(match)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {match.status === "in_progress" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleEnterScore(match)}
                    >
                      <Trophy className="h-4 w-4 mr-1" />
                      Enter Score
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </CardContent>
      </Card>

      <ScoreEntryDialog
        open={isScoreDialogOpen}
        onOpenChange={setIsScoreDialogOpen}
        match={selectedMatch}
        onSuccess={fetchMatches}
      />

      <CourtAssignmentDialog
        open={isCourtDialogOpen}
        onOpenChange={setIsCourtDialogOpen}
        matchId={selectedMatch?.id || null}
        eventId={eventId}
        onSuccess={fetchMatches}
      />
    </>
  );
}
