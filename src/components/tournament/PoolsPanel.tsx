import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Info, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { computeStandings, type Standing } from "@/lib/tournaments/standings";
import { bracketSeedsFromPools, type PoolResult } from "@/lib/tournaments/poolPlay";
import { generateSingleElimination } from "@/lib/tournaments/singleElimination";

interface PoolsPanelProps {
  divisionId: string;
  advancersPerPool: number;
  refreshKey?: number;
  onBracketGenerated: () => void;
}

interface TeamRow {
  id: string;
  team_name: string;
  pool: string | null;
}

interface MatchRow {
  round_number: number;
  team1_id: string | null;
  team2_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
  pool: string | null;
  bracket: string | null;
}

/**
 * The pool stage: one standings table per pool, with the qualifying places
 * marked, and the crossover into the bracket once every pool match is played.
 *
 * Each pool is ranked over its OWN matches only. Ranking a pool against the
 * whole division's results would let a cross-pool match nobody played leak into
 * the table, and would make head-to-head meaningless.
 */
export function PoolsPanel({
  divisionId,
  advancersPerPool,
  refreshKey,
  onBracketGenerated,
}: PoolsPanelProps) {
  const { toast } = useToast();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [teamsRes, matchesRes] = await Promise.all([
      supabase
        .from("tournaments_teams")
        .select("id, team_name, pool")
        .eq("division_id", divisionId),
      supabase
        .from("tournaments_matches")
        .select("round_number, team1_id, team2_id, team1_score, team2_score, status, pool, bracket")
        .eq("division_id", divisionId),
    ]);

    const error = teamsRes.error ?? matchesRes.error;
    if (error) {
      toast({
        title: "Error loading pools",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTeams(teamsRes.data ?? []);
      setMatches(matchesRes.data ?? []);
    }
    setLoading(false);
  }, [divisionId, toast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const pools = useMemo<PoolResult[]>(() => {
    const labels = [...new Set(teams.map((t) => t.pool).filter(Boolean))].sort() as string[];
    return labels.map((label) => ({
      label,
      ordered: computeStandings(
        teams.filter((t) => t.pool === label),
        matches.filter((m) => m.pool === label),
      ),
    }));
  }, [teams, matches]);

  const poolMatches = matches.filter((m) => m.pool !== null);
  const poolMatchesDone = poolMatches.filter((m) => m.status === "completed").length;
  const poolStageComplete = poolMatches.length > 0 && poolMatchesDone === poolMatches.length;
  const bracketExists = matches.some((m) => m.bracket !== null);

  const generateBracket = async () => {
    setGenerating(true);

    const seeds = bracketSeedsFromPools(pools, advancersPerPool);
    if (seeds.length < 2) {
      toast({
        title: "Not enough qualifiers",
        description: "At least two teams must advance to build a bracket.",
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    // Same guard the other generators carry: a redraw is a delete, so it must
    // never run over a bracket that has already been played.
    if (matches.some((m) => m.bracket !== null && m.status === "completed")) {
      toast({
        title: "Cannot redraw bracket",
        description:
          "The playoff bracket already has completed matches. Redrawing would erase results.",
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    // Only clear the bracket stage. Pool results are the input to this draw and
    // must survive it.
    const { error: clearError } = await supabase
      .from("tournaments_matches")
      .delete()
      .eq("division_id", divisionId)
      .not("bracket", "is", null);

    if (clearError) {
      toast({
        title: "Error clearing old bracket",
        description: clearError.message,
        variant: "destructive",
      });
      setGenerating(false);
      return;
    }

    // Pool rounds already used round numbers 1..n. Start the bracket above them
    // so the two stages stay in playing order when matches are listed by round.
    // Read the offset from the matches themselves rather than deriving it from
    // pool size: an odd-sized pool runs an extra round with a sit-out.
    const poolRounds = matches.reduce(
      (max, m) => (m.pool !== null ? Math.max(max, m.round_number) : max),
      0,
    );

    const draw = generateSingleElimination(seeds);
    const { error: insertError } = await supabase.from("tournaments_matches").insert(
      draw.matches.map((m) => ({
        division_id: divisionId,
        round_number: poolRounds + m.round,
        match_number: m.matchNumber,
        team1_id: m.teamA,
        team2_id: m.teamB,
        bracket: "winners",
        status: "scheduled",
      })),
    );

    if (insertError) {
      toast({
        title: "Error generating bracket",
        description: insertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Playoff bracket generated",
        description: `${seeds.length} qualifiers into a ${draw.bracketSize}-team bracket.`,
      });
      onBracketGenerated();
      load();
    }

    setGenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-12 text-center">
        <Users className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-semibold">No pools drawn yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Seed the teams, then draw pools to build the first stage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {poolMatchesDone} of {poolMatches.length} pool matches complete · top{" "}
          {advancersPerPool} from each pool advance
        </p>
        <div className="ml-auto">
          <Button
            onClick={generateBracket}
            disabled={!poolStageComplete || generating}
            variant={bracketExists ? "outline" : "default"}
          >
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trophy className="mr-2 h-4 w-4" />
            )}
            {bracketExists ? "Redraw Playoff Bracket" : "Generate Playoff Bracket"}
          </Button>
        </div>
      </div>

      {!poolStageComplete && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            The playoff bracket unlocks once every pool match has a score. Seeding a
            bracket from an unfinished pool would place teams that haven't earned their
            position yet.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {pools.map((pool) => (
          <PoolTable
            key={pool.label}
            label={pool.label}
            standings={pool.ordered}
            advancers={advancersPerPool}
          />
        ))}
      </div>
    </div>
  );
}

function PoolTable({
  label,
  standings,
  advancers,
}: {
  label: string;
  standings: Standing[];
  advancers: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Pool {label}
          <Badge variant="outline" className="text-[10px]">
            {standings.length} teams
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="w-8 py-1.5 text-left font-semibold">#</th>
                <th className="py-1.5 text-left font-semibold">Team</th>
                <th className="w-12 py-1.5 text-center font-semibold">W-L</th>
                <th className="w-12 py-1.5 text-center font-semibold">Diff</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s) => {
                const advancing = s.rank <= advancers;
                return (
                  <tr
                    key={s.teamId}
                    className={cn(
                      "border-b border-border/50 last:border-0",
                      advancing && "bg-primary/5",
                    )}
                  >
                    <td className="py-1.5">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          advancing
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground",
                        )}
                      >
                        {s.rank}
                      </span>
                    </td>
                    <td className="py-1.5">
                      <span className={cn("truncate", advancing && "font-semibold")}>
                        {s.teamName}
                      </span>
                      {s.tiebreak && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="ml-1.5 inline h-3 w-3 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-sm">Tiebreak: {s.tiebreak}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </td>
                    <td className="py-1.5 text-center tabular-nums">
                      {s.wins}-{s.losses}
                    </td>
                    <td className="py-1.5 text-center tabular-nums">
                      <span
                        className={
                          s.pointDiff >= 0 ? "text-green-600" : "text-muted-foreground"
                        }
                      >
                        {s.pointDiff > 0 ? "+" : ""}
                        {s.pointDiff}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
