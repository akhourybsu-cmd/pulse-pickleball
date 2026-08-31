import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { generateSingleElimination } from "@/lib/tournaments/singleElimination";
import { bracketSizeFor, byeCountFor } from "@/lib/tournaments/seeding";

const bracketSchema = z.object({
  bracket_type: z.enum(["single_elimination", "double_elimination"]),
});

type BracketFormData = z.infer<typeof bracketSchema>;

interface BracketGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionId: string;
  teamCount: number;
  onSuccess: () => void;
}

export function BracketGenerationDialog({ 
  open, 
  onOpenChange, 
  divisionId,
  teamCount,
  onSuccess 
}: BracketGenerationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const form = useForm<BracketFormData>({
    resolver: zodResolver(bracketSchema),
    defaultValues: {
      bracket_type: "single_elimination",
    },
  });

  const isPowerOfTwo = (n: number) => {
    return n > 0 && (n & (n - 1)) === 0;
  };

  const onSubmit = async (data: BracketFormData) => {
    setLoading(true);

    // Get seeded teams
    const { data: teams, error: teamsError } = await supabase
      .from("tournaments_teams")
      .select("id, team_name, seed_number")
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

    // Refuse to wipe a draw that has already been played.
    const { data: played } = await supabase
      .from("tournaments_matches")
      .select("id")
      .eq("division_id", divisionId)
      .eq("status", "completed")
      .limit(1);

    if (played && played.length > 0) {
      toast({
        title: "Cannot regenerate bracket",
        description:
          "This division already has completed matches. Regenerating would erase results.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Delete existing (unplayed) matches
    await supabase
      .from("tournaments_matches")
      .delete()
      .eq("division_id", divisionId);

    // Seeded order — teams already come back ordered by seed_number.
    const draw = generateSingleElimination(teams.map((t) => t.id));

    const matches = draw.matches.map((m) => ({
      division_id: divisionId,
      round_number: m.round,
      match_number: m.matchNumber,
      team1_id: m.teamA,
      team2_id: m.teamB,
      status: "scheduled",
    }));

    // Insert matches
    const { error: insertError } = await supabase
      .from("tournaments_matches")
      .insert(matches);

    if (insertError) {
      toast({
        title: "Error generating bracket",
        description: insertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Bracket generated",
        description:
          `${draw.rounds} rounds on a ${draw.bracketSize}-team bracket` +
          (draw.byes > 0 ? `, ${draw.byes} first-round bye${draw.byes === 1 ? "" : "s"}` : "") +
          `. ${matches.length} match slots created.`,
      });
      onSuccess();
      onOpenChange(false);
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Generate Bracket</DialogTitle>
          <DialogDescription>
            Create elimination bracket for {teamCount} teams
          </DialogDescription>
        </DialogHeader>

        {!isPowerOfTwo(teamCount) && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {teamCount} teams run on a {bracketSizeFor(teamCount)}-team bracket, so the top{" "}
              {byeCountFor(teamCount)} seed{byeCountFor(teamCount) === 1 ? "" : "s"} receive a
              first-round bye and start in round two.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bracket_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bracket Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="single_elimination">
                        Single Elimination
                      </SelectItem>
                      <SelectItem value="double_elimination" disabled>
                        Double Elimination (coming soon)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Single elimination: one loss and you're out. Seeds are drawn
                    1-vs-N so the top seeds meet as late as possible. Double
                    elimination needs a losers bracket and isn't wired up yet.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || teamCount < 2}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Bracket
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
