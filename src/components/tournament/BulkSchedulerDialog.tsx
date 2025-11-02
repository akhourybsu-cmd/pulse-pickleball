import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, Calendar } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

const formSchema = z.object({
  startTime: z.string().min(1, "Start time is required"),
  matchDuration: z.number().min(5, "Duration must be at least 5 minutes").max(180, "Duration must be less than 3 hours"),
  applyTo: z.string(),
  roundNumber: z.number().optional(),
  strategy: z.enum(["fill_courts", "sequential"]),
});

type FormData = z.infer<typeof formSchema>;

interface BulkSchedulerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionId: string;
  matches: any[];
  courts: any[];
  onSuccess: () => void;
}

export function BulkSchedulerDialog({
  open,
  onOpenChange,
  divisionId,
  matches,
  courts,
  onSuccess,
}: BulkSchedulerDialogProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const availableCourts = courts.filter(c => c.available);
  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      startTime: "",
      matchDuration: 30,
      applyTo: "all_unscheduled",
      strategy: "fill_courts",
    },
  });

  const applyTo = form.watch("applyTo");

  const onSubmit = async (data: FormData) => {
    if (availableCourts.length === 0) {
      toast({
        title: "No available courts",
        description: "Mark at least one court as available in the Courts tab before scheduling.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      // Filter matches based on "Apply To" selection
      let targetMatches = matches;

      if (data.applyTo === "all_unscheduled") {
        targetMatches = matches.filter(m => !m.scheduled_time);
      } else if (data.applyTo.startsWith("round_")) {
        const roundNum = parseInt(data.applyTo.split("_")[1]);
        targetMatches = matches.filter(m => m.round_number === roundNum && !m.scheduled_time);
      }

      if (targetMatches.length === 0) {
        toast({
          title: "No matches to schedule",
          description: "All selected matches already have scheduled times.",
        });
        setSubmitting(false);
        return;
      }

      // Sort by round_number, then match_number
      targetMatches.sort((a, b) => {
        if (a.round_number !== b.round_number) return a.round_number - b.round_number;
        return a.match_number - b.match_number;
      });

      const startDateTime = new Date(data.startTime);
      const durationMs = data.matchDuration * 60 * 1000;
      const numCourts = availableCourts.length;

      const updates = [];

      if (data.strategy === "fill_courts") {
        // Fill all courts at each time block before moving to next
        let timeBlockIndex = 0;
        for (let i = 0; i < targetMatches.length; i++) {
          const match = targetMatches[i];
          const courtIndex = i % numCourts;
          
          // Move to next time block when we've filled all courts
          if (i > 0 && courtIndex === 0) {
            timeBlockIndex++;
          }
          
          const scheduledTime = new Date(startDateTime.getTime() + (timeBlockIndex * durationMs));
          
          updates.push({
            id: match.id,
            scheduled_time: scheduledTime.toISOString(),
          });
        }
      } else {
        // Sequential: each match gets next time slot
        for (let i = 0; i < targetMatches.length; i++) {
          const scheduledTime = new Date(startDateTime.getTime() + (i * durationMs));
          updates.push({
            id: targetMatches[i].id,
            scheduled_time: scheduledTime.toISOString(),
          });
        }
      }

      // Bulk update all matches
      for (const update of updates) {
        const { error } = await supabase
          .from("tournaments_matches")
          .update({ scheduled_time: update.scheduled_time })
          .eq("id", update.id);

        if (error) throw error;
      }

      toast({
        title: "Matches scheduled",
        description: `Scheduled ${updates.length} match(es) across ${numCourts} court(s) from ${startDateTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} onward`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error scheduling matches",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Match Times
          </DialogTitle>
        </DialogHeader>

        {availableCourts.length === 0 && (
          <div className="bg-destructive/10 border border-destructive rounded-lg p-4 mb-4">
            <p className="text-sm text-destructive font-medium">
              No available courts. Mark at least one court as available in the Courts tab before scheduling.
            </p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Starting Time *</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormDescription>When should the first match block start?</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="matchDuration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Match Block Length (minutes) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>Time allocated per match (includes play + changeover)</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="applyTo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apply To</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select matches to schedule" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all_unscheduled">All unscheduled matches in this division</SelectItem>
                      {rounds.map(round => (
                        <SelectItem key={round} value={`round_${round}`}>
                          Only matches in Round {round}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="strategy"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Court Rotation Strategy</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="fill_courts" id="fill_courts" />
                        <Label htmlFor="fill_courts" className="font-normal cursor-pointer">
                          Fill all courts at each time block before moving to next time block
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="sequential" id="sequential" />
                        <Label htmlFor="sequential" className="font-normal cursor-pointer">
                          Sequential by match list order
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormDescription>
                    {field.value === "fill_courts" 
                      ? "Example: Courts 1-4 play at 9:00, then Courts 1-4 play at 9:30"
                      : "Example: Match 1 at 9:00, Match 2 at 9:30, Match 3 at 10:00"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || availableCourts.length === 0}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Schedule Matches
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
