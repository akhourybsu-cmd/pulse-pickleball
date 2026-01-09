import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Standing {
  team_id: string;
  team_name: string;
  wins: number;
  losses: number;
  points_for: number;
  points_against: number;
  point_diff: number;
  head_to_head?: number; // For tie-breaking display
}

interface StandingsPanelProps {
  divisionId: string;
  refreshKey?: number;
}

export function StandingsPanel({ divisionId, refreshKey }: StandingsPanelProps) {
  const { toast } = useToast();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [tiebreakInfo, setTiebreakInfo] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculateStandings();
  }, [divisionId, refreshKey]);

  const calculateStandings = async () => {
    setLoading(true);

    // Get all teams
    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select("id, team_name")
      .eq("division_id", divisionId);

    if (teamsError) {
      toast({
        title: "Error loading teams",
        description: teamsError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Get all completed matches
    const { data: matches, error: matchesError } = await supabase
      .from("tournaments_matches")
      .select("*")
      .eq("division_id", divisionId)
      .eq("status", "completed")
      .not("team1_score", "is", null)
      .not("team2_score", "is", null);

    if (matchesError) {
      toast({
        title: "Error loading matches",
        description: matchesError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Calculate standings
    const standingsMap = new Map<string, Standing>();

    teams?.forEach((team) => {
      standingsMap.set(team.id, {
        team_id: team.id,
        team_name: team.team_name,
        wins: 0,
        losses: 0,
        points_for: 0,
        points_against: 0,
        point_diff: 0,
      });
    });

    matches?.forEach((match) => {
      const team1Standing = standingsMap.get(match.team1_id);
      const team2Standing = standingsMap.get(match.team2_id);

      if (team1Standing && team2Standing && match.team1_score !== null && match.team2_score !== null) {
        team1Standing.points_for += match.team1_score;
        team1Standing.points_against += match.team2_score;
        team2Standing.points_for += match.team2_score;
        team2Standing.points_against += match.team1_score;

        if (match.team1_score > match.team2_score) {
          team1Standing.wins++;
          team2Standing.losses++;
        } else {
          team2Standing.wins++;
          team1Standing.losses++;
        }

        team1Standing.point_diff = team1Standing.points_for - team1Standing.points_against;
        team2Standing.point_diff = team2Standing.points_for - team2Standing.points_against;
      }
    });

    // Sort with proper tie-breaking: wins → head-to-head → point differential
    const tiebreakReasons = new Map<string, string>();
    const sortedStandings = Array.from(standingsMap.values()).sort((a, b) => {
      // 1. Sort by wins (descending)
      if (b.wins !== a.wins) return b.wins - a.wins;

      // 2. If tied in wins, check head-to-head
      const h2hResult = calculateHeadToHead(a.team_id, b.team_id, matches || []);
      if (h2hResult !== 0) {
        tiebreakReasons.set(a.team_id, h2hResult < 0 ? `Won H2H vs ${b.team_name}` : `Lost H2H vs ${b.team_name}`);
        return h2hResult;
      }

      // 3. If still tied, use point differential
      if (b.point_diff !== a.point_diff) {
        tiebreakReasons.set(a.team_id, `Point diff: ${a.point_diff > 0 ? '+' : ''}${a.point_diff}`);
      }
      return b.point_diff - a.point_diff;
    });

    setTiebreakInfo(tiebreakReasons);
    setStandings(sortedStandings);
    setLoading(false);
  };

  // Calculate head-to-head record between two teams
  // Returns: -1 if team A should rank higher, 1 if team B, 0 if tied
  const calculateHeadToHead = (teamAId: string, teamBId: string, matches: any[]): number => {
    let teamAWins = 0;
    let teamBWins = 0;

    matches.forEach(match => {
      const isTeamAvsB = 
        (match.team1_id === teamAId && match.team2_id === teamBId) ||
        (match.team1_id === teamBId && match.team2_id === teamAId);

      if (!isTeamAvsB) return;

      // Determine winner
      if (match.team1_id === teamAId && match.team1_score > match.team2_score) {
        teamAWins++;
      } else if (match.team1_id === teamBId && match.team1_score > match.team2_score) {
        teamBWins++;
      } else if (match.team2_id === teamAId && match.team2_score > match.team1_score) {
        teamAWins++;
      } else if (match.team2_id === teamBId && match.team2_score > match.team1_score) {
        teamBWins++;
      }
    });

    // Return -1 if A should rank higher, 1 if B should rank higher
    if (teamAWins > teamBWins) return -1;
    if (teamBWins > teamAWins) return 1;
    return 0;
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
        <CardTitle>Standings</CardTitle>
        <CardDescription>Current tournament rankings</CardDescription>
      </CardHeader>
      <CardContent>
        {standings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No standings available yet. Complete some matches to see rankings.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-center">W</TableHead>
                <TableHead className="text-center">L</TableHead>
                <TableHead className="text-center">PF</TableHead>
                <TableHead className="text-center">PA</TableHead>
                <TableHead className="text-center">Diff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map((standing, index) => (
                <TableRow key={standing.team_id}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="font-medium">
                    {standing.team_name}
                    {tiebreakInfo.has(standing.team_id) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 inline ml-1.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm">{tiebreakInfo.get(standing.team_id)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{standing.wins}</TableCell>
                  <TableCell className="text-center">{standing.losses}</TableCell>
                  <TableCell className="text-center">{standing.points_for}</TableCell>
                  <TableCell className="text-center">{standing.points_against}</TableCell>
                  <TableCell className="text-center">
                    <span className={standing.point_diff >= 0 ? "text-green-600" : "text-red-600"}>
                      {standing.point_diff > 0 ? "+" : ""}
                      {standing.point_diff}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
