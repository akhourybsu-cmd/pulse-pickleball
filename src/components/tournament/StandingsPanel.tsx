import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { computeStandings, type Standing } from "@/lib/tournaments/standings";

interface StandingsPanelProps {
  divisionId: string;
  refreshKey?: number;
}

/**
 * Ranking lives in lib/tournaments/standings so it can be unit-tested and
 * reused by the pool tables. This component previously carried its own copy,
 * which passed head-to-head straight into Array.sort — a non-transitive
 * comparator whose output depends on the order sort happens to compare in.
 */
export function StandingsPanel({ divisionId, refreshKey }: StandingsPanelProps) {
  const { toast } = useToast();
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const [teamsRes, matchesRes] = await Promise.all([
        supabase
          .from("tournaments_teams")
          .select("id, team_name, pool")
          .eq("division_id", divisionId),
        supabase
          .from("tournaments_matches")
          .select("team1_id, team2_id, team1_score, team2_score, status")
          .eq("division_id", divisionId)
          .eq("status", "completed"),
      ]);

      if (cancelled) return;

      const error = teamsRes.error ?? matchesRes.error;
      if (error) {
        toast({
          title: "Error loading standings",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      setStandings(computeStandings(teamsRes.data ?? [], matchesRes.data ?? []));
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [divisionId, refreshKey, toast]);

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
        <CardDescription>
          Ranked on win percentage, then head-to-head, then point differential.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {standings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No standings available yet. Complete some matches to see rankings.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                {standings.map((standing) => (
                  <TableRow key={standing.teamId}>
                    <TableCell className="font-medium">{standing.rank}</TableCell>
                    <TableCell className="font-medium">
                      {standing.teamName}
                      {standing.tiebreak && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3.5 w-3.5 inline ml-1.5 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">Tiebreak: {standing.tiebreak}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{standing.wins}</TableCell>
                    <TableCell className="text-center">{standing.losses}</TableCell>
                    <TableCell className="text-center">{standing.pointsFor}</TableCell>
                    <TableCell className="text-center">{standing.pointsAgainst}</TableCell>
                    <TableCell className="text-center">
                      <span className={standing.pointDiff >= 0 ? "text-green-600" : "text-red-600"}>
                        {standing.pointDiff > 0 ? "+" : ""}
                        {standing.pointDiff}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
