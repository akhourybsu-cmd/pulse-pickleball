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

    // Delete existing matches
    await supabase
      .from("tournaments_matches")
      .delete()
      .eq("division_id", divisionId);

    // Generate bracket based on type
    const matches: any[] = [];
    let matchNumber = 1;

    if (data.bracket_type === "single_elimination") {
      // Find next power of 2
      const bracketSize = Math.pow(2, Math.ceil(Math.log2(teams.length)));
      const firstRoundByes = bracketSize - teams.length;

      // Create first round matches
      let teamIndex = 0;
      for (let i = 0; i < bracketSize / 2; i++) {
        // Determine if this match has byes
        const hasByeTeam1 = i < firstRoundByes && i % 2 === 0;
        const hasByeTeam2 = i < firstRoundByes && i % 2 === 1;

        if (!hasByeTeam1 && !hasByeTeam2 && teamIndex + 1 < teams.length) {
          matches.push({
            division_id: divisionId,
            round_number: 1,
            match_number: matchNumber++,
            team1_id: teams[teamIndex].id,
            team2_id: teams[teamIndex + 1].id,
            status: "scheduled",
          });
          teamIndex += 2;
        }
      }
    } else if (data.bracket_type === "double_elimination") {
      // Winner's bracket first round
      for (let i = 0; i < teams.length; i += 2) {
        if (i + 1 < teams.length) {
          matches.push({
            division_id: divisionId,
            round_number: 1,
            match_number: matchNumber++,
            team1_id: teams[i].id,
            team2_id: teams[i + 1].id,
            status: "scheduled",
          });
        }
      }
    }

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
        description: `${matches.length} matches created for ${data.bracket_type.replace("_", " ")}`,
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
              Team count ({teamCount}) is not a power of 2. Some teams will receive first-round byes.
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
                      <SelectItem value="double_elimination">
                        Double Elimination
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Single: One loss and you're out. Double: Two losses to be eliminated.
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
