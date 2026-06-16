import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Plus, Loader2, Shuffle, Edit, Trash2, CheckCircle2, Award, ListOrdered } from "lucide-react";
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
import { ExportMenu } from "@/components/tournament/ExportMenu";
import { BracketView } from "@/components/tournament/BracketView";
import { ScoreEntryDialog } from "@/components/tournament/ScoreEntryDialog";
import { SeedingManager } from "@/components/tournament/seeding/SeedingManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-premium.svg";

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
  const [matches, setMatches] = useState<any[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [isScoreEntryOpen, setIsScoreEntryOpen] = useState(false);

  useEffect(() => {
    if (divisionId) {
      fetchDivision();
      fetchMatches();
    }
  }, [divisionId, refreshKey]);

  const fetchMatches = async () => {
    const { data } = await supabase
      .from("tournaments_matches")
      .select(`
        *,
        team1:tournaments_teams!tournaments_matches_team1_id_fkey(team_name),
        team2:tournaments_teams!tournaments_matches_team2_id_fkey(team_name)
      `)
      .eq("division_id", divisionId)
      .order("round_number")
      .order("match_number");

    if (data) setMatches(data);
  };

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

    // Generate round robin pairings with proper round scheduling
    const matches: any[] = [];
    let matchNumber = 1;
    
    // Use round robin algorithm that ensures each team plays once per round
    const numTeams = teams.length;
    const numRounds = numTeams % 2 === 0 ? numTeams - 1 : numTeams;
    const matchesPerRound = Math.floor(numTeams / 2);
    
    // Create a working array - if odd number of teams, add a bye
    const participants: (typeof teams[0] | { id: null; team_name: string; seed_number: null })[] = [...teams];
    if (numTeams % 2 === 1) {
      participants.push({ id: null, team_name: "BYE", seed_number: null }); // Bye placeholder
    }
    
    // Round robin rotation algorithm
    for (let round = 0; round < numRounds; round++) {
      for (let match = 0; match < matchesPerRound; match++) {
        const home = match === 0 ? 0 : match;
        const away = participants.length - 1 - match;
        
        // Skip if either team is a bye
        if (participants[home].id && participants[away].id) {
          matches.push({
            division_id: divisionId,
            round_number: round + 1,
            match_number: matchNumber++,
            team1_id: participants[home].id,
            team2_id: participants[away].id,
            status: "scheduled",
          });
        }
      }
      
      // Rotate all teams except the first one (fixed position)
      const fixed = participants[0];
      const rotated = [fixed, participants[participants.length - 1], ...participants.slice(1, participants.length - 1)];
      participants.splice(0, participants.length, ...rotated);
    }

    // Validation: Ensure each team appears only once per round
    const validationErrors: string[] = [];
    for (let round = 1; round <= numRounds; round++) {
      const roundMatches = matches.filter((m) => m.round_number === round);
      const teamsInRound = new Set<string>();
      
      roundMatches.forEach((match) => {
        if (teamsInRound.has(match.team1_id)) {
          validationErrors.push(`Team appears twice in Round ${round}`);
        }
        if (teamsInRound.has(match.team2_id)) {
          validationErrors.push(`Team appears twice in Round ${round}`);
        }
        teamsInRound.add(match.team1_id);
        teamsInRound.add(match.team2_id);
      });
    }

    if (validationErrors.length > 0) {
      toast({
        title: "Validation error",
        description: validationErrors[0],
        variant: "destructive",
      });
      setGenerating(false);
      return;
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
        description: `${matches.length} matches created across ${numRounds} rounds`,
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
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to={`/tournament-admin/event/${division.event_id}`}>
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">{division.name}</h1>
            {getStatusBadge(division.status)}
          </div>
          {division.description && (
            <p className="text-lg text-muted-foreground">{division.description}</p>
          )}
          <p className="text-sm text-muted-foreground">{division.tournaments_events.name}</p>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            {division.status !== "completed" && (
              <>
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
              </>
            )}
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
            <ExportMenu 
              divisionId={divisionId!} 
              divisionName={division.name} 
            />
            {division.status !== "completed" && (
              <Button onClick={() => setIsCreateTeamOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Team
              </Button>
            )}
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
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="seeding">
              <ListOrdered className="h-4 w-4 mr-1" />
              Seeding
            </TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
            {(division.format === "single_elimination" || division.format === "double_elimination") && (
              <TabsTrigger value="bracket">Bracket</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="teams" className="mt-6">
            <TeamsPanel 
              divisionId={divisionId!} 
              refreshKey={refreshKey} 
              divisionStatus={division.status}
            />
          </TabsContent>

          <TabsContent value="seeding" className="mt-6">
            <SeedingManager 
              divisionId={divisionId!} 
              divisionName={division.name} 
            />
          </TabsContent>

          <TabsContent value="matches" className="mt-6">
            <MatchesPanel 
              divisionId={divisionId!} 
              refreshKey={refreshKey}
              divisionStatus={division.status}
            />
          </TabsContent>

          <TabsContent value="standings" className="mt-6">
            <StandingsPanel divisionId={divisionId!} refreshKey={refreshKey} />
          </TabsContent>

          {(division.format === "single_elimination" || division.format === "double_elimination") && (
            <TabsContent value="bracket" className="mt-6">
              <BracketView
                matches={matches}
                format={division.format as "single_elimination" | "double_elimination"}
                onMatchClick={(match) => {
                  setSelectedMatch(match);
                  setIsScoreEntryOpen(true);
                }}
              />
            </TabsContent>
          )}
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

      {selectedMatch && (
        <ScoreEntryDialog
          open={isScoreEntryOpen}
          onOpenChange={setIsScoreEntryOpen}
          match={selectedMatch}
          onSuccess={() => {
            fetchMatches();
            setIsScoreEntryOpen(false);
          }}
        />
      )}
    </div>
  );
}
