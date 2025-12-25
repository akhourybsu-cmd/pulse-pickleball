import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMode } from "@/contexts/ModeContext";
import { toast } from "sonner";

export interface VenueRoundRobinEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  organizer_id: string;
  num_courts: number;
  num_rounds: number;
  games_per_player: number | null;
  current_round: number | null;
  status: "draft" | "live" | "completed";
  rating_eligible: boolean;
  rating_type: string;
  format: string | null;
  venue_id: string | null;
  registration_mode: string | null;
  registration_deadline: string | null;
  max_players: number | null;
  is_published: boolean | null;
  created_at: string;
  player_count?: number;
}

export function useVenueRoundRobins() {
  const { currentVenue } = useMode();
  const queryClient = useQueryClient();

  const {
    data: events = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["venue-round-robins", currentVenue?.venue_id],
    queryFn: async () => {
      if (!currentVenue?.venue_id) return [];

      const { data, error } = await supabase
        .from("round_robin_events")
        .select(`
          *,
          round_robin_players(count)
        `)
        .eq("venue_id", currentVenue.venue_id)
        .order("date", { ascending: false });

      if (error) throw error;

      return (data || []).map((event: any) => ({
        ...event,
        player_count: event.round_robin_players?.[0]?.count || 0,
      })) as VenueRoundRobinEvent[];
    },
    enabled: !!currentVenue?.venue_id,
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("round_robin_events")
        .delete()
        .eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-round-robins"] });
      toast.success("Round robin deleted");
    },
    onError: (error: any) => {
      toast.error("Failed to delete: " + error.message);
    },
  });

  return {
    events,
    isLoading,
    error,
    refetch,
    deleteEvent,
  };
}
