import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const assignmentSchema = z.object({
  court_id: z.string().uuid("Please select a court"),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

interface Court {
  id: string;
  court_number: number;
  court_name: string | null;
  available: boolean;
}

interface Match {
  id: string;
  round_number: number;
  division_id: string;
  court_id: string | null;
  status: string;
}

interface CourtAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string | null;
  eventId: string;
  onSuccess: () => void;
}

export function CourtAssignmentDialog({ 
  open, 
  onOpenChange, 
  matchId, 
  eventId,
  onSuccess 
}: CourtAssignmentDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [currentMatch, setCurrentMatch] = useState<Match | null>(null);
  const [usedCourtIds, setUsedCourtIds] = useState<Set<string>>(new Set());

  const form = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      court_id: "",
    },
  });

  useEffect(() => {
    if (open && matchId) {
      loadMatchAndCourts();
      form.reset();
    }
  }, [open, matchId]);

  const loadMatchAndCourts = async () => {
    if (!matchId) return;

    // Load the current match to get its round number and division
    const { data: match, error: matchError } = await supabase
      .from("tournaments_matches")
      .select("id, round_number, division_id, court_id, status")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      toast({
        title: "Error loading match",
        description: matchError?.message,
        variant: "destructive",
      });
      return;
    }

    setCurrentMatch(match);

    // Get all matches in the same round of the same division to find used courts
    const { data: sameRoundMatches } = await supabase
      .from("tournaments_matches")
      .select("court_id")
      .eq("division_id", match.division_id)
      .eq("round_number", match.round_number)
      .neq("id", matchId)
      .not("court_id", "is", null);

    const usedCourts = new Set<string>(
      sameRoundMatches?.map((m) => m.court_id).filter(Boolean) as string[]
    );
    setUsedCourtIds(usedCourts);

    loadCourts();
  };

  const loadCourts = async () => {
    const { data, error } = await supabase
      .from("tournaments_courts")
      .select("*")
      .eq("event_id", eventId)
      .eq("available", true)
      .order("court_number");

    if (error) {
      toast({
        title: "Error loading courts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setCourts(data || []);
    }
  };

  const onSubmit = async (data: AssignmentFormData) => {
    if (!matchId || !currentMatch) return;

    // Validate court is not already used in this round
    if (usedCourtIds.has(data.court_id)) {
      toast({
        title: "Court conflict",
        description: "This court is already assigned to another match in this round",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const { error } = await supabase
      .from("tournaments_matches")
      .update({ court_id: data.court_id })
      .eq("id", matchId);

    if (error) {
      toast({
        title: "Error assigning court",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Court assigned",
        description: "Match has been assigned to a court",
      });
      onSuccess();
      onOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign Court</DialogTitle>
          <DialogDescription>
            Select which court this match will be played on
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="court_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Court</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a court" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {courts.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No available courts
                        </div>
                      ) : (
                        courts.map((court) => {
                          const isUsedInRound = usedCourtIds.has(court.id);
                          return (
                            <SelectItem 
                              key={court.id} 
                              value={court.id}
                              disabled={isUsedInRound}
                            >
                              Court {court.court_number}
                              {court.court_name && ` (${court.court_name})`}
                              {isUsedInRound && " (In use this round)"}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || courts.length === 0}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign Court
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
