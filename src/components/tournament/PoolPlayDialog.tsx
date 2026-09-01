import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertCircle } from "lucide-react";
import { assignPools, generatePoolPlay, suggestedPoolCount } from "@/lib/tournaments/poolPlay";
import { roundRobinMatchCount } from "@/lib/tournaments/roundRobin";
import { bracketSizeFor } from "@/lib/tournaments/seeding";

interface PoolPlayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionId: string;
  teamCount: number;
  onSuccess: () => void;
}

/**
 * Draw the pool stage.
 *
 * The organizer picks how many pools and how many teams advance; everything
 * else is derived and previewed before anything is written, because a pool draw
 * is the moment a tournament becomes real to the people standing on the courts.
 */
export function PoolPlayDialog({
  open,
  onOpenChange,
  divisionId,
  teamCount,
  onSuccess,
}: PoolPlayDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [poolCount, setPoolCount] = useState(() => suggestedPoolCount(teamCount));
  const [advancers, setAdvancers] = useState(2);

  // Re-suggest when the dialog is reopened after teams have been added.
  useEffect(() => {
    if (open) setPoolCount(suggestedPoolCount(teamCount));
  }, [open, teamCount]);

  const maxPools = Math.max(1, Math.floor(teamCount / 2));
  const poolOptions = Array.from({ length: maxPools }, (_, i) => i + 1);

  // Preview against placeholder ids: sizes and match counts depend only on the
  // shape of the field, not on which teams are in it.
  const preview = useMemo(() => {
    const placeholders = Array.from({ length: teamCount }, (_, i) => `${i}`);
    const pools = assignPools(placeholders, poolCount);
    const matches = pools.reduce((n, p) => n + roundRobinMatchCount(p.teamIds.length), 0);
    const smallest = Math.min(...pools.map((p) => p.teamIds.length));
    return { pools, matches, smallest };
  }, [teamCount, poolCount]);

  const qualifiers = preview.pools.reduce(
    (n, p) => n + Math.min(advancers, p.teamIds.length),
    0,
  );
  const advancersTooHigh = advancers > preview.smallest;

  const onSubmit = async () => {
    setLoading(true);

    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select("id, seed_number")
      .eq("division_id", divisionId)
      .order("seed_number", { ascending: true, nullsFirst: false });

    if (teamsError || !teams || teams.length < 2) {
      toast({
        title: "Error loading teams",
        description: teamsError?.message || "Not enough teams",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Same guard as bracket generation: never wipe a draw that has results.
    const { data: played } = await supabase
      .from("tournaments_matches")
      .select("id")
      .eq("division_id", divisionId)
      .eq("status", "completed")
      .limit(1);

    if (played && played.length > 0) {
      toast({
        title: "Cannot redraw pools",
        description:
          "This division already has completed matches. Redrawing would erase results.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const draw = generatePoolPlay(
      teams.map((t) => t.id),
      poolCount,
    );

    await supabase.from("tournaments_matches").delete().eq("division_id", divisionId);

    // Stamp each team with its pool so the pool tables can be built from the
    // teams alone, without re-deriving the draw.
    const poolOfTeam = new Map<string, string>();
    for (const pool of draw.pools) {
      for (const id of pool.teamIds) poolOfTeam.set(id, pool.label);
    }

    const assignments = await Promise.all(
      [...poolOfTeam.entries()].map(([teamId, pool]) =>
        supabase.from("tournaments_teams").update({ pool }).eq("id", teamId),
      ),
    );
    const assignError = assignments.find((r) => r.error)?.error;
    if (assignError) {
      toast({
        title: "Error assigning pools",
        description: assignError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("tournaments_matches").insert(
      draw.matches.map((m) => ({
        division_id: divisionId,
        round_number: m.round,
        match_number: m.matchNumber,
        team1_id: m.teamA,
        team2_id: m.teamB,
        pool: m.pool,
        status: "scheduled",
      })),
    );

    if (insertError) {
      toast({
        title: "Error generating pool matches",
        description: insertError.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Remember the shape: the bracket stage is generated later and has to use
    // the same numbers the pools were drawn with.
    await supabase
      .from("tournaments_divisions")
      .update({ pool_count: draw.pools.length, advancers_per_pool: advancers })
      .eq("id", divisionId);

    toast({
      title: "Pools drawn",
      description:
        `${draw.pools.length} pool${draw.pools.length === 1 ? "" : "s"}, ` +
        `${draw.matches.length} pool matches. Top ${advancers} from each pool advance.`,
    });
    onSuccess();
    onOpenChange(false);
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Draw Pools</DialogTitle>
          <DialogDescription>
            Split {teamCount} teams into round-robin pools, then advance the top finishers
            into a bracket.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pool-count">Pools</Label>
              <Select
                value={String(poolCount)}
                onValueChange={(v) => setPoolCount(Number(v))}
              >
                <SelectTrigger id="pool-count">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {poolOptions.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} pool{n === 1 ? "" : "s"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="advancers">Advance per pool</Label>
              <Select value={String(advancers)} onValueChange={(v) => setAdvancers(Number(v))}>
                <SelectTrigger id="advancers">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      Top {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {preview.pools.map((p) => (
                <Badge key={p.label} variant="outline" className="font-mono text-xs">
                  Pool {p.label} · {p.teamIds.length}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {preview.matches} pool matches, then {qualifiers} teams into a{" "}
              {bracketSizeFor(qualifiers)}-team bracket. Seeds are dealt serpentine so
              every pool gets a comparable spread, and pool-mates are kept apart in the
              first round of the bracket.
            </p>
          </div>

          {advancersTooHigh && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                The smallest pool has only {preview.smallest} team
                {preview.smallest === 1 ? "" : "s"}, so it can't send {advancers} through.
              </AlertDescription>
            </Alert>
          )}

          {!advancersTooHigh && preview.smallest < 3 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                A pool of {preview.smallest} gives those teams only{" "}
                {preview.smallest - 1} match
                {preview.smallest - 1 === 1 ? "" : "es"} before the bracket. Fewer pools
                means more play for everyone.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={loading || teamCount < 2 || advancersTooHigh}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Draw Pools
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
