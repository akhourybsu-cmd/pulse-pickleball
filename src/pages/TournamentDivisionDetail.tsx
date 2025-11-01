import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Shuffle, Edit, Trash2, CheckCircle2, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateTeamDialog } from "@/components/tournament/CreateTeamDialog";
import { EditDivisionDialog } from "@/components/tournament/EditDivisionDialog";
import { BracketGenerationDialog } from "@/components/tournament/BracketGenerationDialog";
import { TeamsPanel } from "@/components/tournament/TeamsPanel";
import { MatchesPanel } from "@/components/tournament/MatchesPanel";
import { StandingsPanel } from "@/components/tournament/StandingsPanel";

interface Division {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  format: string;
  scoring_ruleset_id: string | null;
  max_teams: number | null;
  status: string;
  tournaments_events: {
    name: string;
  };
}

export default function TournamentDivisionDetail() {
  const { divisionId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [division, setDivision] = useState<Division | null>(null);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
  const [isEditDivisionOpen, setIsEditDivisionOpen] = useState(false);
  const [isBracketDialogOpen, setIsBracketDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    if (divisionId) {
      fetchDivision();
    }
  }, [divisionId]);

  const fetchDivision = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_divisions")
      .select(`
        *,
        tournaments_events (name)
      `)
      .eq("id", divisionId)
      .single();

    if (error) {
      toast({
        title: "Error loading division",
        description: error.message,
        variant: "destructive",
      });
      navigate(-1);
    } else {
      setDivision(data);
      
      // Fetch team count
      const { count } = await supabase
        .from("tournaments_teams")
        .select("*", { count: "exact", head: true })
        .eq("division_id", divisionId);
      setTeamCount(count || 0);
    }
    setLoading(false);
  };

  const handleUpdateDivision = async (updates: any) => {
    const { error } = await supabase
      .from("tournaments_divisions")
      .update(updates)
      .eq("id", divisionId);

    if (error) {
      toast({
        title: "Error updating division",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }

    toast({ title: "Division updated successfully" });
    fetchDivision();
  };

  const handleDeleteDivision = async () => {
    // Check if any matches are completed
    const { data: completedMatches } = await supabase
      .from("tournaments_matches")
      .select("id")
      .eq("division_id", divisionId)
      .eq("status", "completed")
      .limit(1);

    if (completedMatches && completedMatches.length > 0) {
      toast({
        title: "Cannot delete division",
        description: "Division has completed matches and cannot be deleted",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("tournaments_divisions")
      .delete()
      .eq("id", divisionId);

    if (error) {
      toast({
        title: "Error deleting division",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Division deleted successfully" });
    navigate(`/tournament-admin/event/${division?.event_id}`);
  };

  const handleActivateDivision = async () => {
    if (teamCount < 2) {
      toast({
        title: "Cannot activate division",
        description: "You need at least 2 teams to activate a division",
        variant: "destructive",
      });
      return;
    }

    await handleUpdateDivision({ status: "active" });
    toast({ title: "Division activated", description: "You can now generate matches" });
  };

  const handleCompleteDivision = async () => {
    // Check if all matches are completed
    const { data: incompleteMatches } = await supabase
      .from("tournaments_matches")
      .select("id")
      .eq("division_id", divisionId)
      .neq("status", "completed")
      .limit(1);

    if (incompleteMatches && incompleteMatches.length > 0) {
      toast({
        title: "Cannot complete division",
        description: "All matches must be completed before completing the division",
        variant: "destructive",
      });
      return;
    }

    await handleUpdateDivision({ status: "completed" });
    toast({ title: "Division completed", description: "Congratulations on completing this division!" });
  };

  const handleGenerateMatches = async () => {
    if (!divisionId || !division) return;

    if (division.status !== "active") {
      toast({
        title: "Cannot generate matches",
        description: "Division must be in 'active' status to generate matches",
        variant: "destructive",
      });
      return;
    }

    // Handle bracket generation for elimination formats
    if (division.format === "single_elimination" || division.format === "double_elimination") {
      setIsBracketDialogOpen(true);
      return;
    }

    setGenerating(true);

    // Get all teams in division
    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, seed_number")
      .eq("division_id", divisionId)
      .order("seed_number");

    if (teamsError) {
      toast({
        title: "Error loading teams",
        description: teamsError.message,
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    if (!teams || teams.length < 2) {
      toast({
        title: "Not enough teams",
        description: "You need at least 2 teams to generate matches",
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    // Delete existing matches
    await supabase
      .from("tournaments_matches")
      .delete()
      .eq("division_id", divisionId);

    // Generate round robin pairings
    const matches: any[] = [];
    let matchNumber = 1;

    // Round robin algorithm: each team plays every other team once
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matches.push({
          division_id: divisionId,
          round_number: 1,
          match_number: matchNumber++,
          team1_id: teams[i].id,
          team2_id: teams[j].id,
          status: "scheduled",
        });
      }
    }

    // Insert matches
    const { error: insertError } = await supabase
      .from("tournaments_matches")
      .insert(matches);

    if (insertError) {
      toast({
        title: "Error generating matches",
        description: insertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Matches generated",
        description: `${matches.length} matches created for round robin`,
      });
      setRefreshKey((prev) => prev + 1);
    }

    setGenerating(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      active: "default",
      completed: "secondary",
    };
    
    return (
      <Badge variant={variants[status] || "outline"}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!division) return null;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(`/tournament-admin/event/${division.event_id}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to {division.tournaments_events.name}
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold">{division.name}</h1>
              {getStatusBadge(division.status)}
            </div>
            {division.description && (
              <p className="text-muted-foreground mt-2">{division.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsEditDivisionOpen(true)} variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Division?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure? This cannot be undone. Divisions with completed matches cannot be deleted.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteDivision} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Division
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            {division.status === "draft" && (
              <Button onClick={handleActivateDivision} disabled={teamCount < 2} variant="default">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Activate Division
              </Button>
            )}
            {division.status === "active" && (
              <Button onClick={handleCompleteDivision} variant="default">
                <Award className="mr-2 h-4 w-4" />
                Complete Division
              </Button>
            )}
            <Button onClick={() => setIsCreateTeamOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team
            </Button>
            {division.status === "active" && (
              <Button onClick={handleGenerateMatches} disabled={generating} variant="secondary">
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shuffle className="mr-2 h-4 w-4" />
                )}
                {division.format === "round_robin" ? "Generate Matches" : "Generate Bracket"}
              </Button>
            )}
          </div>
        </div>

        {division.status === "draft" && (
          <Alert className="mb-6">
            <AlertDescription>
              This division is in draft mode. Activate it to generate matches. You need at least 2 teams to activate.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="teams" className="w-full">
          <TabsList>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="mt-6">
            <TeamsPanel divisionId={divisionId!} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            <MatchesPanel divisionId={divisionId!} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            <StandingsPanel divisionId={divisionId!} refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>

      <CreateTeamDialog
        open={isCreateTeamOpen}
        onOpenChange={setIsCreateTeamOpen}
        divisionId={divisionId!}
        onSuccess={() => setRefreshKey((prev) => prev + 1)}
      />

      {division && (
        <EditDivisionDialog
          open={isEditDivisionOpen}
          onOpenChange={setIsEditDivisionOpen}
          division={division}
          onSave={handleUpdateDivision}
        />
      )}

      <BracketGenerationDialog
        open={isBracketDialogOpen}
        onOpenChange={setIsBracketDialogOpen}
        divisionId={divisionId!}
        teamCount={teamCount}
        onSuccess={() => {
          setIsBracketDialogOpen(false);
          setRefreshKey((prev) => prev + 1);
        }}
      />
    </div>
  );
}
