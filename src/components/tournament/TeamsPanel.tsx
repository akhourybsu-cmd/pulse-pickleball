import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Users, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Team {
  id: string;
  team_name: string;
  seed_number: number | null;
  player1_id: string | null;
  player2_id: string | null;
  player1?: { full_name: string; display_name: string | null };
  player2?: { full_name: string; display_name: string | null };
}

interface TeamsPanelProps {
  divisionId: string;
  refreshKey?: number;
}

export function TeamsPanel({ divisionId, refreshKey }: TeamsPanelProps) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSeed, setEditingSeed] = useState<string | null>(null);
  const [seedValue, setSeedValue] = useState("");

  useEffect(() => {
    fetchTeams();
  }, [divisionId, refreshKey]);

  const fetchTeams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_teams")
      .select(`
        *,
        player1:profiles!tournaments_teams_player1_id_fkey(full_name, display_name),
        player2:profiles!tournaments_teams_player2_id_fkey(full_name, display_name)
      `)
      .eq("division_id", divisionId)
      .order("seed_number", { ascending: true, nullsFirst: false });

    if (error) {
      toast({
        title: "Error loading teams",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTeams(data || []);
    }
    setLoading(false);
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    const { error } = await supabase
      .from("tournaments_teams")
      .delete()
      .eq("id", teamId);

    if (error) {
      toast({
        title: "Error deleting team",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Team deleted",
        description: `${teamName} has been removed`,
      });
      fetchTeams();
    }
  };

  const handleSaveSeed = async (teamId: string) => {
    const newSeed = parseInt(seedValue);
    if (isNaN(newSeed) || newSeed < 1) {
      toast({
        title: "Invalid seed",
        description: "Seed must be a positive number",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("tournaments_teams")
      .update({ seed_number: newSeed })
      .eq("id", teamId);

    if (error) {
      toast({
        title: "Error updating seed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Seed updated successfully" });
    setEditingSeed(null);
    fetchTeams();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams ({teams.length})</CardTitle>
        <CardDescription>Manage teams in this division</CardDescription>
      </CardHeader>
      <CardContent>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No teams added yet. Click "Add Team" to create your first team.
          </p>
        ) : (
          <div className="space-y-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="flex items-center gap-2">
                    {editingSeed === team.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={seedValue}
                          onChange={(e) => setSeedValue(e.target.value)}
                          className="w-20 h-8"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveSeed(team.id);
                            if (e.key === "Escape") setEditingSeed(null);
                          }}
                        />
                        <Button
                          size="sm"
                          onClick={() => handleSaveSeed(team.id)}
                          className="h-8"
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingSeed(null)}
                          className="h-8"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        {team.seed_number && (
                          <Badge variant="outline" className="font-mono">
                            #{team.seed_number}
                          </Badge>
                        )}
                        {team.seed_number && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditingSeed(team.id);
                              setSeedValue(team.seed_number?.toString() || "");
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      {team.team_name}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {team.player1 && (
                        <span>{team.player1.display_name || team.player1.full_name}</span>
                      )}
                      {team.player1 && team.player2 && <span> & </span>}
                      {team.player2 && (
                        <span>{team.player2.display_name || team.player2.full_name}</span>
                      )}
                      {!team.player1 && !team.player2 && (
                        <span className="text-muted-foreground italic">No players assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Team?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{team.team_name}" and remove them from all matches.
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteTeam(team.id, team.team_name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete Team
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
