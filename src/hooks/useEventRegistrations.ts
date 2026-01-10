import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type RegistrationStatus = 
  | "pending"
  | "confirmed"
  | "waitlisted"
  | "cancelled"
  | "checked_in"
  | "no_show";

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: RegistrationStatus;
  team_id: string | null;
  team_role: string | null;
  registered_at: string;
  confirmed_at: string | null;
  checked_in_at: string | null;
  cancelled_at: string | null;
  waitlist_position: number | null;
  promoted_at: string | null;
  notes: string | null;
}

export interface RegistrationWithProfile extends EventRegistration {
  profile?: {
    id: string;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// Hook for event registrations (admin view)
export function useEventRegistrations(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const registrationsQuery = useQuery({
    queryKey: ["event-registrations", eventId],
    queryFn: async () => {
      if (!eventId) return [];

      // Fetch registrations
      const { data: registrations, error } = await supabase
        .from("event_registrations")
        .select("*")
        .eq("event_id", eventId)
        .order("registered_at", { ascending: true });

      if (error) throw error;
      if (!registrations) return [];

      // Fetch profiles for all users
      const userIds = registrations.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url")
        .in("id", userIds);

      // Combine registrations with profiles
      return registrations.map(reg => ({
        ...reg,
        status: reg.status as RegistrationStatus,
        profile: profiles?.find(p => p.id === reg.user_id),
      })) as RegistrationWithProfile[];
    },
    enabled: !!eventId,
  });

  const updateRegistration = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RegistrationStatus }) => {
      const updates: Partial<EventRegistration> = { status };
      
      if (status === "confirmed") {
        updates.confirmed_at = new Date().toISOString();
      } else if (status === "checked_in") {
        updates.checked_in_at = new Date().toISOString();
      } else if (status === "cancelled") {
        updates.cancelled_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from("event_registrations")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      toast.success("Registration updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update registration: " + error.message);
    },
  });

  const promoteFromWaitlist = useMutation({
    mutationFn: async (registrationId: string) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .update({ 
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          promoted_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      toast.success("Promoted from waitlist");
    },
    onError: (error: Error) => {
      toast.error("Failed to promote: " + error.message);
    },
  });

  const checkIn = useMutation({
    mutationFn: async (registrationId: string) => {
      const { data, error } = await supabase
        .from("event_registrations")
        .update({ 
          status: "checked_in",
          checked_in_at: new Date().toISOString(),
        })
        .eq("id", registrationId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-registrations", eventId] });
      toast.success("Player checked in");
    },
    onError: (error: Error) => {
      toast.error("Failed to check in: " + error.message);
    },
  });

  const confirmedRegistrations = registrationsQuery.data?.filter(
    r => r.status === "confirmed" || r.status === "checked_in"
  ) ?? [];

  const waitlistedRegistrations = registrationsQuery.data?.filter(
    r => r.status === "waitlisted"
  ) ?? [];

  return {
    registrations: registrationsQuery.data ?? [],
    confirmedRegistrations,
    waitlistedRegistrations,
    isLoading: registrationsQuery.isLoading,
    error: registrationsQuery.error,
    refetch: registrationsQuery.refetch,
    updateRegistration,
    promoteFromWaitlist,
    checkIn,
  };
}

// Hook for user's own registrations
export function useMyEventRegistrations() {
  const queryClient = useQueryClient();

  const registrationsQuery = useQuery({
    queryKey: ["my-event-registrations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from("event_registrations")
        .select(`
          *,
          event:unified_events(
            id,
            title,
            event_type,
            start_time,
            end_time,
            venue_id,
            host_venue_id
          )
        `)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .order("registered_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const registerForEvent = useMutation({
    mutationFn: async ({ 
      eventId, 
      notes 
    }: { 
      eventId: string; 
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check event capacity
      const { data: event } = await supabase
        .from("unified_events")
        .select("max_participants, current_participants, waitlist_enabled")
        .eq("id", eventId)
        .single();

      let status: RegistrationStatus = "confirmed";
      
      if (event && event.max_participants) {
        if (event.current_participants >= event.max_participants) {
          if (event.waitlist_enabled) {
            status = "waitlisted";
          } else {
            throw new Error("Event is full");
          }
        }
      }

      const { data, error } = await supabase
        .from("event_registrations")
        .insert({
          event_id: eventId,
          user_id: user.id,
          status,
          notes,
          confirmed_at: status === "confirmed" ? new Date().toISOString() : null,
        })
        .select()
        .single();

      if (error) throw error;
      return { registration: data, status };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["my-event-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      
      if (result.status === "waitlisted") {
        toast.info("Added to waitlist");
      } else {
        toast.success("Registered for event");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelRegistration = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from("event_registrations")
        .update({ 
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
        })
        .eq("id", registrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-event-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      toast.success("Registration cancelled");
    },
    onError: (error: Error) => {
      toast.error("Failed to cancel: " + error.message);
    },
  });

  const isRegisteredForEvent = (eventId: string): boolean => {
    return registrationsQuery.data?.some(
      r => r.event_id === eventId && r.status !== "cancelled"
    ) ?? false;
  };

  const getRegistrationForEvent = (eventId: string) => {
    return registrationsQuery.data?.find(
      r => r.event_id === eventId && r.status !== "cancelled"
    );
  };

  return {
    registrations: registrationsQuery.data ?? [],
    isLoading: registrationsQuery.isLoading,
    error: registrationsQuery.error,
    refetch: registrationsQuery.refetch,
    registerForEvent,
    cancelRegistration,
    isRegisteredForEvent,
    getRegistrationForEvent,
  };
}
