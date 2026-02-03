import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, GripVertical, Shuffle, Trophy, Lock, Unlock, Save } from "lucide-react";

interface Team {
  id: string;
  team_name: string;
  division_id: string;
  seed_number: number | null;
  seed_source: string | null;
  seed_locked: boolean | null;
  player1_id: string | null;
  captain_rating?: number;
}

interface SeedingManagerProps {
  divisionId: string;
  divisionName: string;
}

export function SeedingManager({ divisionId, divisionName }: SeedingManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, [divisionId]);

  const fetchTeams = async () => {
    setLoading(true);
    
    // Fetch teams
    const { data: teamsData, error } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, division_id, seed_number, seed_source, seed_locked, player1_id")
      .eq("division_id", divisionId)
      .order("seed_number", { ascending: true, nullsFirst: false });

    if (error) {
      toast({ title: "Error loading teams", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch player ratings from profiles
    const player1Ids = teamsData?.map(t => t.player1_id).filter(Boolean) as string[] || [];
    let profiles: { id: string; current_rating: number | null }[] = [];
    
    if (player1Ids.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, current_rating")
        .in("id", player1Ids);
      
      profiles = profilesData || [];
    }

    const teamsWithRatings: Team[] = (teamsData || []).map(team => ({
      ...team,
      captain_rating: profiles.find(p => p.id === team.player1_id)?.current_rating || 0,
    }));

    setTeams(teamsWithRatings);
    setLoading(false);
  };

  const handleAutoSeed = (method: string) => {
    let sortedTeams = [...teams];
    
    switch (method) {
      case "pulse_rating":
        sortedTeams.sort((a, b) => (b.captain_rating || 0) - (a.captain_rating || 0));
        break;
      case "random":
        sortedTeams = sortedTeams.sort(() => Math.random() - 0.5);
        break;
      default:
        return;
    }

    // Apply seeds, respecting locked teams
    let seed = 1;
    const newTeams = sortedTeams.map(team => {
      if (team.seed_locked) {
        return team;
      }
      return { ...team, seed_number: seed++, seed_source: method };
    });

    setTeams(newTeams);
    setHasChanges(true);
  };

  const handleMoveSeed = (teamId: string, direction: "up" | "down") => {
    const index = teams.findIndex(t => t.id === teamId);
    if (index === -1) return;
    
    const team = teams[index];
    if (team.seed_locked) return;

    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= teams.length) return;
    
    const targetTeam = teams[newIndex];
    if (targetTeam.seed_locked) return;

    const newTeams = [...teams];
    [newTeams[index], newTeams[newIndex]] = [newTeams[newIndex], newTeams[index]];
    
    // Reassign seeds
    newTeams.forEach((t, i) => {
      if (!t.seed_locked) {
        t.seed_number = i + 1;
        t.seed_source = "manual";
      }
    });

    setTeams(newTeams);
    setHasChanges(true);
  };

  const handleToggleLock = (teamId: string) => {
    setTeams(prev => prev.map(t => 
      t.id === teamId ? { ...t, seed_locked: !t.seed_locked } : t
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    for (const team of teams) {
      const { error } = await supabase
        .from("tournaments_teams")
        .update({
          seed_number: team.seed_number,
          seed_source: team.seed_source,
          seed_locked: team.seed_locked,
        })
        .eq("id", team.id);

      if (error) {
        toast({ title: "Error saving seeds", description: error.message, variant: "destructive" });
        setSaving(false);
        return;
      }
    }

    toast({ title: "Seeds saved", description: "Team seeding has been updated" });
    setHasChanges(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Seeding Manager</h2>
          <p className="text-muted-foreground">{divisionName} - {teams.length} teams</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Seeds
          </Button>
        </div>
      </div>

      {/* Auto-Seed Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auto-Seed Options</CardTitle>
          <CardDescription>Automatically order teams based on selected criteria</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => handleAutoSeed("pulse_rating")}
            className="gap-2"
          >
            <Trophy className="h-4 w-4" />
            By PULSE Rating
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAutoSeed("random")}
            className="gap-2"
          >
            <Shuffle className="h-4 w-4" />
            Random
          </Button>
        </CardContent>
      </Card>

      {/* Teams List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Team Seeding</CardTitle>
          <CardDescription>Use arrows to reorder. Lock seeds to prevent changes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {teams.map((team, index) => (
                <div
                  key={team.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    team.seed_locked 
                      ? "bg-muted/50 border-muted" 
                      : "bg-background hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-2 w-12">
                    <GripVertical className={`h-4 w-4 ${team.seed_locked ? "text-muted" : "text-muted-foreground"}`} />
                    <span className="font-bold text-lg">{team.seed_number || index + 1}</span>
                  </div>
                  
                  <div className="flex-1">
                    <p className="font-medium">{team.team_name}</p>
                    {team.captain_rating && team.captain_rating > 0 && (
                      <p className="text-xs text-muted-foreground">Rating: {team.captain_rating.toFixed(1)}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {team.seed_source && (
                      <Badge variant="outline" className="text-xs">
                        {team.seed_source === "pulse_rating" ? "By Rating" : 
                         team.seed_source === "random" ? "Random" : "Manual"}
                      </Badge>
                    )}

                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveSeed(team.id, "up")}
                        disabled={index === 0 || team.seed_locked === true}
                      >
                        <span className="text-xs">↑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleMoveSeed(team.id, "down")}
                        disabled={index === teams.length - 1 || team.seed_locked === true}
                      >
                        <span className="text-xs">↓</span>
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleLock(team.id)}
                      className={team.seed_locked ? "text-primary" : "text-muted-foreground"}
                    >
                      {team.seed_locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bracket Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bracket Preview</CardTitle>
          <CardDescription>How teams will be matched in elimination rounds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {teams.slice(0, Math.min(8, teams.length)).map((team, index) => {
              const isFirst = index % 2 === 0;
              return (
                <div 
                  key={team.id}
                  className={`p-2 rounded border ${isFirst ? "border-b-0 rounded-b-none" : "border-t-0 rounded-t-none"}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-6 h-6 flex items-center justify-center text-xs">
                      {team.seed_number || index + 1}
                    </Badge>
                    <span className="truncate">{team.team_name}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {teams.length > 8 && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Showing first 8 teams. Full bracket available in bracket view.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
