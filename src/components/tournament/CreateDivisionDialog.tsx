import { useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const divisionSchema = z.object({
  name: z.string().min(1, "Division name is required"),
  description: z.string().optional(),
  format: z.enum(["round_robin"]),
  scoring_ruleset_id: z.string().uuid("Please select a scoring ruleset"),
  max_teams: z.number().int().min(2, "Minimum 2 teams").max(64, "Maximum 64 teams").optional(),
});

type DivisionFormData = z.infer<typeof divisionSchema>;

interface ScoringRuleset {
  id: string;
  name: string;
  description: string | null;
  games_to: number;
  win_by_2: boolean;
  best_of: number;
}

interface CreateDivisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess: () => void;
}

export function CreateDivisionDialog({ open, onOpenChange, eventId, onSuccess }: CreateDivisionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rulesets, setRulesets] = useState<ScoringRuleset[]>([]);

  const form = useForm<DivisionFormData>({
    resolver: zodResolver(divisionSchema),
    defaultValues: {
      name: "",
      description: "",
      format: "round_robin",
      scoring_ruleset_id: "",
    },
  });

  const loadRulesets = async () => {
    console.log("Loading scoring rulesets...");
    const { data, error } = await supabase
      .from("tournaments_scoring_rulesets")
      .select("*")
      .order("name");

    console.log("Rulesets response:", { data, error });

    if (error) {
      console.error("Ruleset error:", error);
      toast({
        title: "Error loading scoring rulesets",
        description: error.message,
        variant: "destructive",
      });
    } else {
      console.log("Setting rulesets:", data);
      setRulesets(data || []);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    console.log("Dialog open change:", newOpen);
    if (newOpen) {
      console.log("Dialog opening, loading rulesets...");
      loadRulesets();
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: DivisionFormData) => {
    setLoading(true);
    const { error } = await supabase.from("tournaments_divisions").insert({
      event_id: eventId,
      name: data.name,
      description: data.description || null,
      format: data.format,
      scoring_ruleset_id: data.scoring_ruleset_id,
      max_teams: data.max_teams || null,
    });

    if (error) {
      toast({
        title: "Error creating division",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Division created",
        description: `${data.name} has been added to the event`,
      });
      onSuccess();
      handleOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Division</DialogTitle>
          <DialogDescription>
            Add a new division to this tournament event
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Division Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Men's 4.0, Women's Open" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Division details, skill level requirements, etc."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Format</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="round_robin">Round Robin</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Single elimination coming in Phase 4</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scoring_ruleset_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scoring Ruleset</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scoring rules" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {rulesets.map((ruleset) => (
                        <SelectItem key={ruleset.id} value={ruleset.id}>
                          {ruleset.name}
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
              name="max_teams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Teams (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Leave empty for unlimited"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Division
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
