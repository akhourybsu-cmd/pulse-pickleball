import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";

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
  scheduled_time?: string | null;
  score_edited_by?: string | null;
  score_edited_at?: string | null;
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
  const [submitting, setSubmitting] = useState(false);
  const [editHistory, setEditHistory] = useState<{
    editor_name: string;
    edited_at: string;
    original_score?: string;
  } | null>(null);

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
      scheduled_time: z.string().optional(),
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
      scheduled_time: match?.scheduled_time ? new Date(match.scheduled_time).toISOString().slice(0, 16) : "",
      notes: match?.notes || "",
    },
  });

  const onSubmit = async (data: ScoreFormData) => {
    if (!match) return;

    setSubmitting(true);

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

    // Update scheduled_time if provided
    if (data.scheduled_time) {
      updateData.scheduled_time = new Date(data.scheduled_time).toISOString();
    }

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
    setSubmitting(false);
  };

  // Fetch edit history when dialog opens
  useEffect(() => {
    const fetchEditHistory = async () => {
      if (open && match?.score_edited_at && match?.score_edited_by) {
        const { data: editorData } = await supabase
          .from("profiles")
          .select("display_name, full_name")
          .eq("id", match.score_edited_by)
          .single();
        
        if (editorData) {
          setEditHistory({
            editor_name: editorData.display_name || editorData.full_name,
            edited_at: match.score_edited_at,
          });
        }
      } else {
        setEditHistory(null);
      }
    };

    fetchEditHistory();
  }, [open, match?.score_edited_at, match?.score_edited_by]);

  // Reset form when dialog opens with new match
  useEffect(() => {
    if (open && match) {
      form.reset({
        team1_score: match.team1_score || 0,
        team2_score: match.team2_score || 0,
        scheduled_time: match.scheduled_time ? new Date(match.scheduled_time).toISOString().slice(0, 16) : "",
        notes: match.notes || "",
      });
    }
  }, [open, match]);

  if (!match) return null;

  // Get form values to show validation preview
  const team1Score = form.watch("team1_score");
  const team2Score = form.watch("team2_score");
  
  // Real-time validation preview
  const getValidationPreview = () => {
    if (!ruleset || team1Score === undefined || team2Score === undefined) return null;
    
    const maxScore = Math.max(team1Score, team2Score);
    const minScore = Math.min(team1Score, team2Score);
    const scoreDiff = Math.abs(team1Score - team2Score);
    
    // Check if someone reached winning score
    if (maxScore < ruleset.games_to) {
      return { valid: false, icon: XCircle, color: "text-red-600", message: `Must reach ${ruleset.games_to}` };
    }
    
    // Check win-by-2 if required
    if (ruleset.win_by_2 && scoreDiff < 2) {
      return { valid: false, icon: AlertCircle, color: "text-yellow-600", message: "Must win by 2" };
    }
    
    // Check no ties
    if (team1Score === team2Score) {
      return { valid: false, icon: XCircle, color: "text-red-600", message: "Scores cannot be tied" };
    }
    
    return { valid: true, icon: CheckCircle, color: "text-green-600", message: "Valid score" };
  };
  
  const validationPreview = getValidationPreview();
  
  const getExampleScores = () => {
    if (!ruleset) return "";
    const base = ruleset.games_to;
    if (ruleset.win_by_2) {
      return `${base}-${base-2}, ${base+1}-${base-1}, ${base+2}-${base}`;
    }
    return `${base}-${base-1}, ${base}-${base-2}, ${base+1}-${base-1}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Enter Match Score</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-lg font-semibold">
              {match.team1.team_name} vs {match.team2.team_name}
            </div>
            {ruleset && (
              <Alert className="bg-primary/10 border-primary/20">
                <AlertDescription className="text-base font-medium">
                  <strong>Scoring Rules:</strong> First to {ruleset.games_to}
                  {ruleset.win_by_2 && ", win by 2"}
                  {ruleset.best_of > 1 && `, best of ${ruleset.best_of}`}
                </AlertDescription>
              </Alert>
            )}
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
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">Valid range: 0-99</p>
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
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">Valid range: 0-99</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Validation Preview */}
              {validationPreview && (
                <Card className={`p-3 ${validationPreview.valid ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                  <div className="flex items-center gap-2">
                    <validationPreview.icon className={`h-5 w-5 ${validationPreview.color}`} />
                    <span className={`font-medium ${validationPreview.color}`}>
                      {validationPreview.message}
                    </span>
                  </div>
                </Card>
              )}
              
              {/* Example Valid Scores */}
              {ruleset && (
                <div className="text-sm text-muted-foreground">
                  <strong>Example valid scores:</strong> {getExampleScores()}
                </div>
              )}

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Time (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="datetime-local" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">When is this match scheduled to start?</p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Match Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Add any notes about this match..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Edit History */}
              {editHistory && (
                <Alert>
                  <AlertDescription className="text-sm">
                    <strong>Edit History:</strong> Score was updated by {editHistory.editor_name} on{" "}
                    {new Date(editHistory.edited_at).toLocaleString()}
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </Form>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={form.handleSubmit(onSubmit)} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Score
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
