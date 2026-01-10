import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EventType = 
  | "round_robin"
  | "tournament"
  | "open_play"
  | "lesson"
  | "clinic"
  | "league"
  | "social"
  | "private_rental";

export type HostType = "individual" | "venue" | "group" | "court";

export type EventStatus = 
  | "draft"
  | "published"
  | "registration_open"
  | "registration_closed"
  | "in_progress"
  | "completed"
  | "cancelled";

export type EventVisibility = "public" | "private" | "invite_only";

export interface UnifiedEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  host_type: HostType;
  host_user_id: string | null;
  host_venue_id: string | null;
  host_group_id: string | null;
  host_court_id: string | null;
  start_time: string;
  end_time: string | null;
  timezone: string;
  location_type: string | null;
  venue_id: string | null;
  court_id: string | null;
  location_address: string | null;
  location_name: string | null;
  max_participants: number | null;
  current_participants: number;
  waitlist_enabled: boolean;
  waitlist_max: number | null;
  price: number;
  price_label: string | null;
  skill_level: string | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  rating_eligible: boolean;
  rating_type: string | null;
  visibility: EventVisibility;
  status: EventStatus;
  is_published: boolean;
  is_recurring: boolean;
  series_id: string | null;
  recurrence_rule: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  legacy_table: string | null;
  legacy_id: string | null;
}

export interface BrowseEvent extends UnifiedEvent {
  host_name: string | null;
  display_location: string | null;
  confirmed_count: number;
  waitlist_count: number;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  event_type: EventType;
  host_type: HostType;
  host_user_id?: string;
  host_venue_id?: string;
  host_group_id?: string;
  host_court_id?: string;
  start_time: string;
  end_time?: string;
  timezone?: string;
  location_type?: string;
  venue_id?: string;
  court_id?: string;
  location_address?: string;
  location_name?: string;
  max_participants?: number;
  waitlist_enabled?: boolean;
  waitlist_max?: number;
  price?: number;
  price_label?: string;
  skill_level?: string;
  skill_level_min?: number;
  skill_level_max?: number;
  rating_eligible?: boolean;
  rating_type?: string;
  visibility?: EventVisibility;
  status?: EventStatus;
  is_published?: boolean;
  notes?: string;
}

export interface RoundRobinExtension {
  format?: string;
  num_courts: number;
  num_rounds?: number;
  games_per_player?: number;
  registration_deadline?: string;
  registration_mode?: string;
}

export interface TournamentExtension {
  registration_open_date?: string;
  registration_close_date?: string;
  registration_fee?: number;
  registration_enabled?: boolean;
  public_view_enabled?: boolean;
}

export interface InstructionExtension {
  instructor_name?: string;
  instructor_id?: string;
  coach_id?: string;
  focus_areas?: string[];
  equipment_provided?: boolean;
}

// Hook for browsing public events
export function useBrowseEvents(options?: {
  eventType?: EventType;
  hostVenueId?: string;
  hostGroupId?: string;
  hostCourtId?: string;
  startAfter?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["browse-events", options],
    queryFn: async () => {
      let query = supabase
        .from("v_browse_events")
        .select("*")
        .order("start_time", { ascending: true });

      if (options?.eventType) {
        query = query.eq("event_type", options.eventType);
      }
      if (options?.hostVenueId) {
        query = query.eq("host_venue_id", options.hostVenueId);
      }
      if (options?.hostGroupId) {
        query = query.eq("host_group_id", options.hostGroupId);
      }
      if (options?.hostCourtId) {
        query = query.eq("host_court_id", options.hostCourtId);
      }
      if (options?.startAfter) {
        query = query.gte("start_time", options.startAfter);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as BrowseEvent[];
    },
  });
}

// Hook for venue-specific events
export function useVenueUnifiedEvents(venueId: string | undefined) {
  const queryClient = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["venue-unified-events", venueId],
    queryFn: async () => {
      if (!venueId) return [];

      const { data, error } = await supabase
        .from("unified_events")
        .select("*")
        .eq("host_venue_id", venueId)
        .order("start_time", { ascending: false });

      if (error) throw error;
      return data as UnifiedEvent[];
    },
    enabled: !!venueId,
  });

  const createEvent = useMutation({
    mutationFn: async (input: CreateEventInput & {
      roundRobin?: RoundRobinExtension;
      tournament?: TournamentExtension;
      instruction?: InstructionExtension;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { roundRobin, tournament, instruction, ...eventData } = input;

      // Create main event
      const { data: event, error: eventError } = await supabase
        .from("unified_events")
        .insert({
          ...eventData,
          created_by: user.id,
        })
        .select()
        .single();

      if (eventError) throw eventError;

      // Create extension if needed
      if (input.event_type === "round_robin" && roundRobin) {
        const { error: rrError } = await supabase
          .from("event_round_robin")
          .insert({
            event_id: event.id,
            ...roundRobin,
          });
        if (rrError) throw rrError;
      }

      if (input.event_type === "tournament" && tournament) {
        const { error: tError } = await supabase
          .from("event_tournament")
          .insert({
            event_id: event.id,
            ...tournament,
          });
        if (tError) throw tError;
      }

      if ((input.event_type === "lesson" || input.event_type === "clinic") && instruction) {
        const { error: iError } = await supabase
          .from("event_instruction")
          .insert({
            event_id: event.id,
            ...instruction,
          });
        if (iError) throw iError;
      }

      return event as UnifiedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-unified-events", venueId] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      toast.success("Event created successfully");
    },
    onError: (error: Error) => {
      toast.error("Failed to create event: " + error.message);
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<UnifiedEvent> & { id: string }) => {
      const { data, error } = await supabase
        .from("unified_events")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as UnifiedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-unified-events", venueId] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      toast.success("Event updated");
    },
    onError: (error: Error) => {
      toast.error("Failed to update event: " + error.message);
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("unified_events")
        .delete()
        .eq("id", eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-unified-events", venueId] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      toast.success("Event deleted");
    },
    onError: (error: Error) => {
      toast.error("Failed to delete event: " + error.message);
    },
  });

  const publishEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase
        .from("unified_events")
        .update({ 
          is_published: true, 
          status: "published" 
        })
        .eq("id", eventId)
        .select()
        .single();

      if (error) throw error;
      return data as UnifiedEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venue-unified-events", venueId] });
      queryClient.invalidateQueries({ queryKey: ["browse-events"] });
      toast.success("Event published");
    },
    onError: (error: Error) => {
      toast.error("Failed to publish event: " + error.message);
    },
  });

  return {
    events: eventsQuery.data ?? [],
    isLoading: eventsQuery.isLoading,
    error: eventsQuery.error,
    refetch: eventsQuery.refetch,
    createEvent,
    updateEvent,
    deleteEvent,
    publishEvent,
  };
}

// Hook for a single event with extensions
export function useUnifiedEvent(eventId: string | undefined) {
  return useQuery({
    queryKey: ["unified-event", eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data: event, error: eventError } = await supabase
        .from("unified_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      // Fetch extension based on type
      let extension = null;
      
      if (event.event_type === "round_robin") {
        const { data } = await supabase
          .from("event_round_robin")
          .select("*")
          .eq("event_id", eventId)
          .single();
        extension = data;
      } else if (event.event_type === "tournament") {
        const { data } = await supabase
          .from("event_tournament")
          .select("*")
          .eq("event_id", eventId)
          .single();
        extension = data;
      } else if (event.event_type === "lesson" || event.event_type === "clinic") {
        const { data } = await supabase
          .from("event_instruction")
          .select("*")
          .eq("event_id", eventId)
          .single();
        extension = data;
      }

      return { event: event as UnifiedEvent, extension };
    },
    enabled: !!eventId,
  });
}
