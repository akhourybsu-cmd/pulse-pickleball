import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Tournament {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled";
  is_public: boolean;
  divisions_count: number;
  payment_status: "draft" | "pending" | "paid" | "failed";
  stripe_checkout_session_id: string | null;
  paid_at: string | null;
  created_by: string;
  created_at: string;
}

export interface TournamentDivision {
  id: string;
  event_id: string;
  name: string;
  skill_level?: string | null;
  format: string | null;
  description?: string | null;
  max_teams?: number;
  status?: string;
  created_at: string;
}

export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTournaments = async () => {
    try {
      const { data, error } = await supabase
        .from("tournaments_events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTournaments((data as Tournament[]) || []);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      toast.error("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  return { tournaments, loading, refetch: fetchTournaments };
}

export function useTournament(id: string | undefined) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<TournamentDivision[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTournament = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    try {
      const [tournamentRes, divisionsRes] = await Promise.all([
        supabase
          .from("tournaments_events")
          .select("*")
          .eq("id", id)
          .single(),
        supabase
          .from("tournaments_divisions")
          .select("*")
          .eq("event_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (tournamentRes.error) throw tournamentRes.error;
      setTournament(tournamentRes.data as Tournament);
      const divisionsData = (divisionsRes.data || []).map((d: Record<string, unknown>) => ({
        ...d,
        skill_level: (d.skill_level as string) || null,
      })) as TournamentDivision[];
      setDivisions(divisionsData);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      toast.error("Failed to load tournament");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTournament();
  }, [id]);

  const createDivision = async (division: { event_id: string; name: string; skill_level?: string | null; format?: string | null }) => {
    try {
      const { error } = await supabase
        .from("tournaments_divisions")
        .insert({
          event_id: division.event_id,
          name: division.name,
          format: division.format || null,
        });

      if (error) throw error;
      await fetchTournament();
      return true;
    } catch (error) {
      console.error("Error creating division:", error);
      toast.error("Failed to create division");
      return false;
    }
  };

  const updateDivision = async (divisionId: string, updates: { name?: string; format?: string | null }) => {
    try {
      const { error } = await supabase
        .from("tournaments_divisions")
        .update(updates)
        .eq("id", divisionId);

      if (error) throw error;
      await fetchTournament();
      return true;
    } catch (error) {
      console.error("Error updating division:", error);
      toast.error("Failed to update division");
      return false;
    }
  };

  const deleteDivision = async (divisionId: string) => {
    try {
      const { error } = await supabase
        .from("tournaments_divisions")
        .delete()
        .eq("id", divisionId);

      if (error) throw error;
      await fetchTournament();
      return true;
    } catch (error) {
      console.error("Error deleting division:", error);
      toast.error("Failed to delete division");
      return false;
    }
  };

  const updateTournament = async (updates: Partial<Tournament>) => {
    if (!id) return false;
    try {
      const { error } = await supabase
        .from("tournaments_events")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      await fetchTournament();
      return true;
    } catch (error) {
      console.error("Error updating tournament:", error);
      toast.error("Failed to update tournament");
      return false;
    }
  };

  return {
    tournament,
    divisions,
    loading,
    refetch: fetchTournament,
    createDivision,
    updateDivision,
    deleteDivision,
    updateTournament,
  };
}

export async function createTournament(data: {
  name: string;
  description?: string | null;
  location?: string | null;
  start_date?: string;
  end_date?: string;
  is_public?: boolean;
  venue_id?: string;
}): Promise<string | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("You must be logged in to create a tournament");
      return null;
    }

    const { data: tournament, error } = await supabase
      .from("tournaments_events")
      .insert({
        name: data.name,
        description: data.description || null,
        location: data.location || null,
        start_date: data.start_date || new Date().toISOString().split("T")[0],
        end_date: data.end_date || new Date().toISOString().split("T")[0],
        is_public: data.is_public ?? true,
        status: "draft",
        payment_status: "draft",
        created_by: userData.user.id,
        venue_id: data.venue_id || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return tournament.id;
  } catch (error) {
    console.error("Error creating tournament:", error);
    toast.error("Failed to create tournament");
    return null;
  }
}

export async function initiateCheckout(tournamentId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("create-tournament-checkout", {
      body: { tournament_id: tournamentId },
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start checkout";
    console.error("Error initiating checkout:", error);
    toast.error(message);
    return null;
  }
}
