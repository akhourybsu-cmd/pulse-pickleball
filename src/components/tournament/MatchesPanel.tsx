import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Play, Trophy, MapPin, Edit, FileText, Trash2 } from "lucide-react";
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
  started_at: string | null;
  completed_at: string | null;
  actual_duration_minutes: number | null;
  notes: string | null;
  score_edited_at: string | null;
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

  const handleChangeCourt = (match: Match) => {
    setSelectedMatch(match);
    setIsCourtDialogOpen(true);
  };

  const handleDeleteMatch = async (match: Match) => {
    const { error } = await supabase
      .from("tournaments_matches")
      .delete()
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error deleting match",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Match deleted",
        description: `Match #${match.match_number} has been removed`,
      });
      fetchMatches();
    }
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
                    {match.notes && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <FileText className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{match.notes}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  <div className="font-medium">
                    {match.team1.team_name} vs {match.team2.team_name}
                  </div>
                  {match.team1_score !== null && match.team2_score !== null && (
                    <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                      <span>Score: {match.team1_score} - {match.team2_score}</span>
                      {match.score_edited_at && (
                        <span className="text-xs">(edited)</span>
                      )}
                      {match.actual_duration_minutes && (
                        <span className="text-xs">
                          • {match.actual_duration_minutes} min
                        </span>
                      )}
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
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChangeCourt(match)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Change Court
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleStartMatch(match)}
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    </>
                  )}
                  {match.status === "in_progress" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleChangeCourt(match)}
                      >
                        <MapPin className="h-4 w-4 mr-1" />
                        Change Court
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleEnterScore(match)}
                      >
                        <Trophy className="h-4 w-4 mr-1" />
                        Enter Score
                      </Button>
                    </>
                  )}
                  {match.status === "completed" && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEnterScore(match)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit Score
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Match?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete Match #{match.match_number} ({match.team1.team_name} vs {match.team2.team_name}).
                              {match.team1_score !== null && match.team2_score !== null && (
                                <span className="block mt-2 font-semibold text-amber-600">
                                  Warning: This match has scores recorded ({match.team1_score} - {match.team2_score})
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteMatch(match)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete Match
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                  {match.status !== "completed" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Match?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete Match #{match.match_number} ({match.team1.team_name} vs {match.team2.team_name}). This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteMatch(match)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete Match
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
