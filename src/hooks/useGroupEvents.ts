import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type GroupRsvpStatus = "going" | "maybe" | "not_going" | "waitlist";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export interface GroupEvent {
  viewer_desk_registration?: boolean;
  walk_in_places?: number;
  price_cents?: number;
  currency?: string;
  registration_paused?: boolean;
  registration_closes_at?: string | null;
  cancellation_policy?: string | null;
  canceled_at?: string | null;
  cancellation_reason?: string | null;
  pending_places?: number;
  checkout_order_id?: string | null;
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location_type: "court" | "venue" | "custom" | null;
  court_id: string | null;
  venue_court_id: string | null;
  venue_id: string | null;
  parent_event_id: string | null;
  custom_location: string | null;
  capacity: number | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  is_recurring: boolean;
  recurring_rule: string | null;
  event_format:
    | "open_play"
    | "round_robin"
    | "practice"
    | "social"
    | "clinic"
    | "other";
  waitlist_enabled: boolean;
  waitlist_limit: number | null;
  series_id: string | null;
  rr_courts: number | null;
  rr_games_per_player: number | null;
  rotation_style: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_profile?: {
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
  rsvps?: {
    going: number;
    maybe: number;
    not_going: number;
    waitlist: number;
  };
  user_rsvp?: GroupRsvpStatus | null;
}

async function fetchGroupEvents(groupId: string): Promise<GroupEvent[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch events
  const { data: eventsData, error } = await supabase
    .from("group_events")
    .select("*")
    .eq("group_id", groupId)
    .is("parent_event_id", null)
    .is("canceled_at", null)
    .gte("start_time", new Date().toISOString())
    .order("start_time", { ascending: true });

  if (error) throw error;

  // Fetch creator profiles
  const creatorIds = [...new Set((eventsData || []).map((e) => e.created_by))];
  const { data: profilesData } = await supabase
    .from("profiles_public")
    .select("id, display_name, full_name, avatar_url")
    .in("id", creatorIds);

  const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

  // Fetch RSVPs
  const eventIds = (eventsData || []).map((e) => e.id);
  const { data: rsvpsData } = await supabase
    .from("group_event_rsvps")
    .select("event_id, user_id, status")
    .in("event_id", eventIds);

  // Group RSVPs by event
  const rsvpsMap = new Map<
    string,
    {
      going: number;
      maybe: number;
      not_going: number;
      waitlist: number;
      user_rsvp: GroupRsvpStatus | null;
    }
  >();
  (eventsData || []).forEach((e) => {
    rsvpsMap.set(e.id, {
      going: 0,
      maybe: 0,
      not_going: 0,
      waitlist: 0,
      user_rsvp: null,
    });
  });

  (rsvpsData || []).forEach((r) => {
    const entry = rsvpsMap.get(r.event_id);
    if (entry) {
      if (r.status === "going") entry.going++;
      else if (r.status === "maybe") entry.maybe++;
      else if (r.status === "not_going") entry.not_going++;
      else if (r.status === "waitlist") entry.waitlist++;
      if (user && r.user_id === user.id)
        entry.user_rsvp = r.status as GroupRsvpStatus;
    }
  });

  return (eventsData || []).map((e) => {
    const rsvpEntry = rsvpsMap.get(e.id);
    return {
      ...e,
      location_type: e.location_type as GroupEvent["location_type"],
      event_format: (e.event_format ??
        "open_play") as GroupEvent["event_format"],
      creator_profile: profilesMap.get(e.created_by),
      rsvps: rsvpEntry
        ? {
            going: rsvpEntry.going,
            maybe: rsvpEntry.maybe,
            not_going: rsvpEntry.not_going,
            waitlist: rsvpEntry.waitlist,
          }
        : undefined,
      user_rsvp: rsvpEntry?.user_rsvp ?? null,
    };
  });
}

export function useGroupEvents(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: events = [],
    isLoading: loading,
    refetch,
  } = useQuery({
    queryKey: ["group-events", groupId],
    queryFn: () => fetchGroupEvents(groupId!),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!groupId,
  });

  // Accepts either a single event payload (the common path — single-shot
  // event creation) or a 'series' shape that produces N rows in one
  // batch insert. Recurring series are stored as N flat rows in
  // group_events, each tagged with is_recurring=true + the same
  // recurring_rule string (e.g. "WEEKLY:8"); the rows share their
  // recurring_rule and a synthetic series_key derived from
  // first start_time + rule. Per-row RSVP / delete stays per-row.
  const createEventMutation = useMutation({
    mutationFn: async (eventData: {
      title: string;
      description?: string;
      start_time: string;
      end_time?: string;
      location_type?: "court" | "venue" | "custom";
      custom_location?: string;
      venue_id?: string;
      /** Venue programming can reserve several physical courts while remaining one public event. */
      venue_court_ids?: string[];
      capacity?: number;
      skill_level_min?: number;
      skill_level_max?: number;
      /** ISO start timestamps for additional occurrences (excluding start_time itself). */
      additional_starts?: string[];
      /** Explicit venue-local ends preserve wall-clock duration across DST. */
      additional_ends?: string[];
      /** Recurrence rule string, e.g. "WEEKLY:8". Applied to every inserted row. */
      recurring_rule?: string;
      event_format?:
        | "open_play"
        | "round_robin"
        | "practice"
        | "social"
        | "clinic"
        | "other";
      waitlist_enabled?: boolean;
      waitlist_limit?: number;
      rr_courts?: number;
      rr_games_per_player?: number;
      rotation_style?:
        | "paddle_stack"
        | "timed_rotation"
        | "winners_stay"
        | "organized_games"
        | "coach_led";
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const {
        additional_starts,
        additional_ends,
        recurring_rule,
        venue_court_ids,
        ...base
      } = eventData;
      const isSeries =
        !!recurring_rule &&
        Array.isArray(additional_starts) &&
        additional_starts.length > 0;

      // For a single event, end_time is the user-set ISO. For a series,
      // we slide end_time alongside start_time by the same delta so each
      // occurrence keeps its duration.
      const endDelta =
        base.end_time && base.start_time
          ? new Date(base.end_time).getTime() -
            new Date(base.start_time).getTime()
          : null;

      // Recurring occurrences share one series_id so the series can be
      // identified (and bulk-managed) without a separate table.
      const seriesId = isSeries
        ? (globalThis.crypto?.randomUUID?.() ??
          `${Date.now()}-${Math.random()}`)
        : null;

      const baseRow = {
        group_id: groupId,
        created_by: user.id,
        ...base,
        ...(isSeries
          ? { is_recurring: true, recurring_rule, series_id: seriesId }
          : { is_recurring: false }),
      };

      const rows = isSeries
        ? [
            baseRow,
            ...additional_starts!.map((iso, index) => ({
              ...baseRow,
              start_time: iso,
              end_time:
                additional_ends?.[index] ??
                (endDelta != null
                  ? new Date(new Date(iso).getTime() + endDelta).toISOString()
                  : undefined),
            })),
          ]
        : [baseRow];

      if (base.venue_id) {
        if (
          !groupId ||
          !venue_court_ids?.length ||
          rows.some((event) => !event.end_time)
        ) {
          throw new Error(
            "Venue programs require a duration and dedicated courts.",
          );
        }
        const { data, error } = await supabase.rpc("create_venue_program", {
          p_group: groupId,
          p_venue: base.venue_id,
          p_events: rows,
          p_court_ids: venue_court_ids,
        });
        if (error?.code === "23P01")
          throw new Error(
            "A selected court was just booked. Choose available courts and try again.",
          );
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from("group_events")
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      toast({
        title: "Event Created!",
        description:
          count > 1
            ? `${count} occurrences scheduled`
            : "Your event has been scheduled",
      });
      queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
      queryClient.invalidateQueries({ queryKey: ["venue-event-conflicts"] });
      const venueId = Array.isArray(data) ? data[0]?.venue_id : null;
      if (venueId)
        queryClient.invalidateQueries({ queryKey: ["venue-day", venueId] });
    },
    onError: (error: unknown) => {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to create event"),
        variant: "destructive",
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data, error } = await supabase
        .from("group_events")
        .delete()
        .eq("id", eventId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data)
        throw new Error(
          "The event was not deleted. Refresh and check your access.",
        );
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Event has been removed" });
      queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
      queryClient.invalidateQueries({ queryKey: ["venue-day"] });
      queryClient.invalidateQueries({ queryKey: ["venue-event-conflicts"] });
    },
    onError: (error: unknown) => {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to delete event"),
        variant: "destructive",
      });
    },
  });

  // Admin-only in practice (RLS restricts updates to admins/creators):
  // capacity + waitlist settings for a single event.
  const updateEventMutation = useMutation({
    mutationFn: async ({
      eventId,
      updates,
    }: {
      eventId: string;
      updates: Partial<{
        title: string;
        description: string | null;
        capacity: number | null;
        waitlist_enabled: boolean;
        waitlist_limit: number | null;
        custom_location: string | null;
        rr_courts: number | null;
        rr_games_per_player: number | null;
      }>;
    }) => {
      const { data, error } = await supabase
        .from("group_events")
        .update(updates)
        .eq("id", eventId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data)
        throw new Error(
          "The event was not updated. Refresh and check your access.",
        );
      // Loosening capacity can free spots — promote whoever is queued.
      const { error: waitlistError } = await supabase.rpc(
        "promote_group_event_waitlist",
        {
          p_event_id: eventId,
        },
      );
      if (waitlistError)
        throw new Error(
          "Event settings were saved, but the waitlist could not be processed. Please retry the save.",
        );
    },
    onSuccess: () => {
      toast({ title: "Saved", description: "Event settings updated" });
      queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
    },
    onError: (error: unknown) => {
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to update event"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
      queryClient.invalidateQueries({ queryKey: ["venue-day"] });
      queryClient.invalidateQueries({ queryKey: ["venue-event-conflicts"] });
    },
  });

  const updateRsvp = async (
    eventId: string,
    status: "going" | "maybe" | "not_going",
  ) => {
    // Optimistic: flip the user's RSVP and adjust the counts in the cached
    // events immediately so the pill responds on tap, then write + reconcile.
    const key = ["group-events", groupId];
    const prev = queryClient.getQueryData<GroupEvent[]>(key);
    queryClient.setQueryData<GroupEvent[]>(key, (old) =>
      (old ?? []).map((e) => {
        if (e.id !== eventId) return e;
        const oldStatus = e.user_rsvp ?? null;
        if (oldStatus === status) return e;
        const counts: Record<string, number> = {
          going: 0,
          maybe: 0,
          not_going: 0,
          waitlist: 0,
          ...(e.rsvps ?? {}),
        };
        if (oldStatus && oldStatus in counts)
          counts[oldStatus] = Math.max(0, counts[oldStatus] - 1);
        if (status in counts) counts[status] = counts[status] + 1;
        return {
          ...e,
          user_rsvp: status,
          rsvps: {
            going: counts.going,
            maybe: counts.maybe,
            not_going: counts.not_going,
            waitlist: counts.waitlist,
          },
        };
      }),
    );

    try {
      // Single server entry point: enforces capacity, routes overflow to the
      // waitlist, and auto-promotes the next person when someone drops out.
      const { data: finalStatus, error } = await supabase.rpc(
        "set_group_event_rsvp",
        {
          p_event_id: eventId,
          p_status: status,
        },
      );
      if (error) throw error;

      if (finalStatus === "waitlist" && status === "going") {
        toast({
          title: "You're on the waitlist",
          description:
            "This event is full — we'll move you in automatically if a spot opens.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
      return finalStatus as GroupRsvpStatus;
    } catch (error: unknown) {
      // Roll back the optimistic change to the last known-good snapshot.
      if (prev)
        queryClient.setQueryData<GroupEvent[]>(key, (current) =>
          current?.map((event) =>
            event.id === eventId
              ? (prev.find((previous) => previous.id === eventId) ?? event)
              : event,
          ),
        );
      console.error("Error updating RSVP:", error);
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to update RSVP"),
        variant: "destructive",
      });
      return undefined;
    } finally {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  return {
    events,
    loading,
    createEvent: createEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    updateEvent: updateEventMutation.mutateAsync,
    updateRsvp,
    refetch,
  };
}

// Export for prefetching
export { fetchGroupEvents };
