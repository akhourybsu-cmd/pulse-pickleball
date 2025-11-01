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

interface PlayerOption {
  id: string;
  full_name: string;
  display_name: string | null;
}

interface Team {
  id: string;
  team_name: string;
  seed_number: number | null;
  player1_id: string | null;
  player2_id: string | null;
}

const teamSchema = z.object({
  team_name: z.string().trim().min(1, "Team name is required").max(100),
  seed_number: z.number().int().min(1, "Seed must be at least 1").optional(),
  player1_id: z.string().uuid("Please select Player 1").optional(),
  player2_id: z.string().uuid("Please select Player 2").optional(),
}).refine(
  (data) => {
    if (data.player1_id && data.player2_id) {
      return data.player1_id !== data.player2_id;
    }
    return true;
  },
  {
    message: "Players must be different",
    path: ["player2_id"],
  }
);

type TeamFormData = z.infer<typeof teamSchema>;

interface EditTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team;
  onSuccess: () => void;
}

export function EditTeamDialog({ open, onOpenChange, team, onSuccess }: EditTeamDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<PlayerOption[]>([]);

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      team_name: team.team_name,
      seed_number: team.seed_number || undefined,
      player1_id: team.player1_id || undefined,
      player2_id: team.player2_id || undefined,
    },
  });

  useEffect(() => {
    if (open) {
      loadPlayers();
      form.reset({
        team_name: team.team_name,
        seed_number: team.seed_number || undefined,
        player1_id: team.player1_id || undefined,
        player2_id: team.player2_id || undefined,
      });
    }
  }, [open, team]);

  const loadPlayers = async () => {
    const { data, error } = await supabase
      .from("profiles_public")
      .select("id, full_name, display_name")
      .order("full_name");

    if (!error && data) {
      setPlayers(data);
    }
  };

  const onSubmit = async (data: TeamFormData) => {
    setLoading(true);

    const { error } = await supabase
      .from("tournaments_teams")
      .update({
        team_name: data.team_name,
        seed_number: data.seed_number || null,
        player1_id: data.player1_id || null,
        player2_id: data.player2_id || null,
      })
      .eq("id", team.id);

    if (error) {
      toast({
        title: "Error updating team",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Team updated",
        description: `${data.team_name} has been updated`,
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
          <DialogTitle>Edit Team</DialogTitle>
          <DialogDescription>
            Update team information and player assignments
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
                    <Input placeholder="e.g., Smith/Jones" {...field} />
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
                      placeholder="e.g., 1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormDescription>
                    Tournament seeding for bracket generation
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
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    >
                      <option value="">Select Player 1</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.display_name || player.full_name}
                        </option>
                      ))}
                    </select>
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
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    >
                      <option value="">Select Player 2</option>
                      {players.map((player) => (
                        <option key={player.id} value={player.id}>
                          {player.display_name || player.full_name}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Team
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
