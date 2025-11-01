import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Loader2, Shuffle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreateTeamDialog } from "@/components/tournament/CreateTeamDialog";
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
  const [generating, setGenerating] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
    }
    setLoading(false);
  };

  const handleGenerateMatches = async () => {
    if (!divisionId) return;

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
            <h1 className="text-4xl font-bold">{division.name}</h1>
            {division.description && (
              <p className="text-muted-foreground mt-2">{division.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsCreateTeamOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Team
            </Button>
            <Button onClick={handleGenerateMatches} disabled={generating} variant="secondary">
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shuffle className="mr-2 h-4 w-4" />
              )}
              Generate Matches
            </Button>
          </div>
        </div>

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
    </div>
  );
}
