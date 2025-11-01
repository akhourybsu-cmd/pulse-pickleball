import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  division_id: string;
  team1: { team_name: string };
  team2: { team_name: string };
  team1_score?: number | null;
  team2_score?: number | null;
  notes?: string | null;
  status: string;
  tournaments_divisions: {
    tournaments_scoring_rulesets: {
      games_to: number;
      win_by_2: boolean;
      best_of: number;
    } | null;
  };
}

interface ScoreEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: Match | null;
  onSuccess: () => void;
}

export function ScoreEntryDialog({ open, onOpenChange, match, onSuccess }: ScoreEntryDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const ruleset = match?.tournaments_divisions?.tournaments_scoring_rulesets;

  // Create dynamic schema based on ruleset
  const createScoreSchema = () => {
    const gamesTo = ruleset?.games_to || 11;
    const winBy2 = ruleset?.win_by_2 ?? true;

    return z.object({
      team1_score: z.number()
        .int("Score must be a whole number")
        .min(0, "Score cannot be negative")
        .max(99, "Score must be less than 100"),
      team2_score: z.number()
        .int("Score must be a whole number")
        .min(0, "Score cannot be negative")
        .max(99, "Score must be less than 100"),
      notes: z.string().optional(),
    }).refine((data) => {
      // Scores cannot be tied
      if (data.team1_score === data.team2_score) {
        return false;
      }
      return true;
    }, {
      message: "Scores cannot be tied",
      path: ["team2_score"],
    }).refine((data) => {
      const winningScore = Math.max(data.team1_score, data.team2_score);
      const losingScore = Math.min(data.team1_score, data.team2_score);

      // Check if winning score meets minimum requirement
      if (winningScore < gamesTo && winningScore !== gamesTo - 1) {
        return false;
      }

      // If win_by_2 is required
      if (winBy2) {
        // Once someone reaches gamesTo, they must win by 2
        if (winningScore >= gamesTo) {
          if (winningScore - losingScore < 2) {
            return false;
          }
        }
      } else {
        // Without win by 2, first to gamesTo wins
        if (winningScore < gamesTo) {
          return false;
        }
      }

      return true;
    }, {
      message: winBy2 
        ? `Score must reach ${gamesTo} and win by 2` 
        : `Score must reach ${gamesTo} to win`,
      path: ["team1_score"],
    });
  };

  type ScoreFormData = z.infer<ReturnType<typeof createScoreSchema>>;

  const form = useForm<ScoreFormData>({
    resolver: zodResolver(createScoreSchema()),
    defaultValues: {
      team1_score: match?.team1_score || 0,
      team2_score: match?.team2_score || 0,
      notes: match?.notes || "",
    },
  });

  useEffect(() => {
    if (open && match) {
      form.reset({
        team1_score: match.team1_score || 0,
        team2_score: match.team2_score || 0,
        notes: match.notes || "",
      });
    }
  }, [open, match]);

  const onSubmit = async (data: ScoreFormData) => {
    if (!match) return;

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    const isEdit = match.status === "completed";

    // Calculate duration if this is the initial completion
    let durationMinutes = null;
    if (!isEdit && match.status === "in_progress") {
      const { data: matchData } = await supabase
        .from("tournaments_matches")
        .select("started_at")
        .eq("id", match.id)
        .single();

      if (matchData?.started_at) {
        const startTime = new Date(matchData.started_at);
        const endTime = new Date();
        durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);
      }
    }

    const updateData: any = {
      team1_score: data.team1_score,
      team2_score: data.team2_score,
      notes: data.notes || null,
      status: "completed",
    };

    // Only set completed_at if this is the first completion
    if (!isEdit) {
      updateData.completed_at = new Date().toISOString();
    }

    if (durationMinutes !== null) {
      updateData.actual_duration_minutes = durationMinutes;
    }

    if (isEdit && user) {
      updateData.score_edited_by = user.id;
      updateData.score_edited_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("tournaments_matches")
      .update(updateData)
      .eq("id", match.id);

    if (error) {
      toast({
        title: "Error saving score",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: isEdit ? "Score updated" : "Score saved",
        description: `${match.team1.team_name} ${data.team1_score} - ${data.team2_score} ${match.team2.team_name}`,
      });
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  if (!match) return null;

  const gamesTo = ruleset?.games_to || 11;
  const winBy2 = ruleset?.win_by_2 ?? true;
  const isEdit = match.status === "completed";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Score" : "Enter Score"}</DialogTitle>
          <DialogDescription>
            {match.team1.team_name} vs {match.team2.team_name}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg text-sm">
          <p className="font-medium mb-1">Scoring Rules</p>
          <p className="text-muted-foreground">
            First to {gamesTo}{winBy2 ? ", win by 2" : ""}
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="team1_score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{match.team1.team_name} Score</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="team2_score"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{match.team2.team_name} Score</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                      value={field.value}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any notes about this match..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormDescription>
              Enter the final score for this match
            </FormDescription>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Update Score" : "Save Score"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
