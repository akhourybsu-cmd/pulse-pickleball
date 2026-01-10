import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

type TournamentStatus = Database["public"]["Enums"]["tournament_status"];
type TournamentVisibility = Database["public"]["Enums"]["tournament_visibility"];

export interface VenueTournament {
  id: string;
  name: string;
  slug: string | null;
  status: TournamentStatus;
  visibility: TournamentVisibility;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  description: string | null;
  external_registration_url: string | null;
  divisions_count: number | null;
  created_at: string;
  updated_at: string;
}

interface CreateTournamentData {
  name: string;
  venueId: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  description?: string;
  visibility?: TournamentVisibility;
  externalRegistrationUrl?: string;
}

/**
 * Hook to manage tournaments for a specific venue
 */
export function useVenueTournaments(venueId: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tournamentsQuery = useQuery({
    queryKey: ["venue-tournaments", venueId],
    queryFn: async (): Promise<VenueTournament[]> => {
      if (!venueId) return [];

      const { data, error } = await supabase
        .from("tournaments_events")
        .select(`
          id,
          name,
          slug,
          status,
          visibility,
          start_date,
          end_date,
          location,
          description,
          external_registration_url,
          divisions_count,
          created_at,
          updated_at
        `)
        .eq("venue_id", venueId)
        .order("start_date", { ascending: false, nullsFirst: false });

      if (error) {
        console.error("Error fetching venue tournaments:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!venueId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const createTournamentMutation = useMutation({
    mutationFn: async (data: CreateTournamentData) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication required");

      const { data: tournament, error } = await supabase
        .from("tournaments_events")
        .insert({
          name: data.name,
          venue_id: data.venueId,
          created_by: user.id,
          start_date: data.startDate || new Date().toISOString().split("T")[0],
          end_date: data.endDate,
          location: data.location,
          description: data.description,
          visibility: data.visibility || "public",
          external_registration_url: data.externalRegistrationUrl,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return tournament;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-tournaments", venueId] });
      toast({
        title: "Tournament created",
        description: "Your tournament has been created successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create tournament",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTournamentMutation = useMutation({
    mutationFn: async ({ 
      tournamentId, 
      updates 
    }: { 
      tournamentId: string; 
      updates: Partial<{
        name: string;
        status: TournamentStatus;
        visibility: TournamentVisibility;
        start_date: string;
        end_date: string;
        location: string;
        description: string;
        external_registration_url: string;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("tournaments_events")
        .update(updates)
        .eq("id", tournamentId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-tournaments", venueId] });
      toast({
        title: "Tournament updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update tournament",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    tournaments: tournamentsQuery.data || [],
    isLoading: tournamentsQuery.isLoading,
    error: tournamentsQuery.error,
    refetch: tournamentsQuery.refetch,
    createTournament: createTournamentMutation.mutateAsync,
    isCreating: createTournamentMutation.isPending,
    updateTournament: updateTournamentMutation.mutateAsync,
    isUpdating: updateTournamentMutation.isPending,
  };
}
