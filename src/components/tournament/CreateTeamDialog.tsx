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
import { Loader2 } from "lucide-react";
import { PlayerCombobox } from "@/components/PlayerCombobox";

interface Player {
  id: string;
  full_name: string;
  display_name: string | null;
  current_rating: number;
}

const teamSchema = z.object({
  team_name: z.string().min(1, "Team name is required"),
  seed_number: z.number().int().min(1, "Seed must be at least 1").optional(),
  player1_id: z.string().uuid("Please select Player 1").optional(),
  player2_id: z.string().uuid("Please select Player 2").optional(),
}).refine((data) => !data.player1_id || !data.player2_id || data.player1_id !== data.player2_id, {
  message: "Players must be different",
  path: ["player2_id"],
});

type TeamFormData = z.infer<typeof teamSchema>;

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisionId: string;
  onSuccess: () => void;
}

export function CreateTeamDialog({ open, onOpenChange, divisionId, onSuccess }: CreateTeamDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    if (open) {
      loadPlayers();
    }
  }, [open]);

  const loadPlayers = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, current_rating")
      .order("full_name");

    if (!error && data) {
      setPlayers(data);
    }
  };

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      team_name: "",
      seed_number: undefined,
      player1_id: undefined,
      player2_id: undefined,
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset();
    }
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: TeamFormData) => {
    setLoading(true);
    const { error } = await supabase.from("tournaments_teams").insert({
      division_id: divisionId,
      team_name: data.team_name,
      seed_number: data.seed_number || null,
      player1_id: data.player1_id || null,
      player2_id: data.player2_id || null,
    });

    if (error) {
      toast({
        title: "Error creating team",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Team created",
        description: `${data.team_name} has been added`,
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
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Add a new team to this division
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="team_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Team Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Team Smith/Jones" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seed_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seed Number (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Leave empty for auto-assign"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Used for bracket placement in elimination rounds
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="player1_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 1 (Optional)</FormLabel>
                  <FormControl>
                    <PlayerCombobox
                      players={players}
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      placeholder="Select player 1"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="player2_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Player 2 (Optional)</FormLabel>
                  <FormControl>
                    <PlayerCombobox
                      players={players}
                      value={field.value || ""}
                      onValueChange={field.onChange}
                      placeholder="Select player 2"
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
                Create Team
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
