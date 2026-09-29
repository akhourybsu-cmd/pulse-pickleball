import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "./useAuthState";
import type { GroupEvent, GroupRsvpStatus } from "./useGroupEvents";
import { isConfirmedVenueRsvp } from "@/lib/venues/experience";
import {
  PROGRAM_FORMATS,
  programPhase,
  withConfirmedProgramRsvp,
} from "@/lib/venues/programExperience";

export async function fetchUpcomingVenuePrograms(venueId: string) {
  const { data, error } = await supabase
    .from("group_events")
    .select(
      "id,title,description,start_time,end_time,event_format,capacity,skill_level_min,skill_level_max,price_cents,currency,registration_paused"
    )
    .eq("venue_id", venueId)
    .is("parent_event_id", null)
    .is("canceled_at", null)
    .in("event_format", [...PROGRAM_FORMATS])
    .gte("start_time", new Date().toISOString())
    .order("start_time")
    .limit(3);
  if (error) throw error;
  return data ?? [];
}

export async function fetchVenueProgram(
  venueId: string,
  eventId: string,
  viewerId: string
) {
  const { data, error } = await supabase
    .from("group_events")
    .select("*")
    .eq("venue_id", venueId)
    .eq("id", eventId)
    .is("parent_event_id", null)
    .in("event_format", [...PROGRAM_FORMATS])
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "This program is no longer available. It may have been removed or your access may have changed."
    );
  const [rsvps, membership] = await Promise.all([
    supabase
      .from("group_event_rsvps")
      .select("user_id,status")
      .eq("event_id", eventId),
    supabase
      .from("group_members")
      .select("status")
      .eq("group_id", data.group_id)
      .eq("user_id", viewerId)
      .maybeSingle(),
  ]);
  if (rsvps.error) throw rsvps.error;
  if (membership.error) throw membership.error;
  const counts = { going: 0, maybe: 0, not_going: 0, waitlist: 0 };
  let viewerRsvp: GroupRsvpStatus | null = null;
  for (const row of rsvps.data ?? []) {
    if (!isConfirmedVenueRsvp(row.status)) continue;
    counts[row.status] += 1;
    if (row.user_id === viewerId) viewerRsvp = row.status;
  }
  let availability: {
    pending_places?: number;
    checkout_order_id?: string | null;
    walk_in_places?: number;
    viewer_desk_registration?: boolean;
  } = {};
  {
    const result = await (supabase as any).rpc(
      "get_venue_program_availability",
      { p_event: eventId }
    );
    if (result.error) throw result.error;
    availability = result.data;
  }
  counts.going += availability.walk_in_places || 0;
  return {
    event: {
      ...data,
      ...availability,
      rsvps: counts,
      user_rsvp: viewerRsvp,
    } as GroupEvent,
    canRsvp: membership.data?.status === "active",
  };
}

export async function fetchVenueProgramRoster(eventId: string) {
  const { data, error } = await supabase.rpc("get_venue_program_roster", {
    p_event_id: eventId,
  });
  if (error) throw error;
  if (!Array.isArray(data))
    throw new Error("The player roster could not be confirmed.");
  return data;
}

export function useVenuePrograms(
  venueId: string | null | undefined,
  selectedId: string | null
) {
  const { user } = useAuthState();
  const client = useQueryClient();
  const lock = useRef(false);
  const [saving, setSaving] = useState(false);
  const upcoming = useQuery({
    queryKey: ["venue-upcoming-programs", venueId, user?.id],
    enabled: !!venueId && !!user,
    queryFn: () => fetchUpcomingVenuePrograms(venueId!),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const detailKey = ["venue-program", venueId, selectedId, user?.id];
  const detail = useQuery({
    queryKey: detailKey,
    enabled: !!venueId && !!selectedId && !!user,
    queryFn: () => fetchVenueProgram(venueId!, selectedId!, user!.id),
    staleTime: 0,
    refetchInterval: saving ? false : 30_000,
    refetchOnWindowFocus: !saving,
  });
  const rosterKey = ["venue-program-roster", venueId, selectedId, user?.id];
  const roster = useQuery({
    queryKey: rosterKey,
    enabled: !!venueId && !!selectedId && !!user,
    queryFn: () => fetchVenueProgramRoster(selectedId!),
    staleTime: 0,
    refetchInterval: saving ? false : 30_000,
    refetchOnWindowFocus: !saving,
  });
  const updateRsvp = async (
    eventId: string,
    status: "going" | "maybe" | "not_going" | "waitlist"
  ) => {
    if (lock.current)
      throw new Error("Your previous response is still being confirmed.");
    if (eventId !== selectedId || !detail.data?.canRsvp || detail.isError)
      throw new Error(
        "Registration access could not be confirmed. Reload the program."
      );
    if (programPhase(detail.data.event) === "ended")
      throw new Error("This program has ended. Registration is closed.");
    lock.current = true;
    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("set_group_event_rsvp", {
        p_event_id: eventId,
        p_status: status,
      });
      if (error) throw error;
      if (!isConfirmedVenueRsvp(data))
        throw new Error("Registration was not confirmed. Please try again.");
      await client.cancelQueries({ queryKey: detailKey });
      client.setQueryData<typeof detail.data>(detailKey, (previous) =>
        previous
          ? {
              ...previous,
              event: withConfirmedProgramRsvp(previous.event, data),
            }
          : previous
      );
      void client.invalidateQueries({ queryKey: detailKey });
      void client.invalidateQueries({ queryKey: rosterKey });
      void client.invalidateQueries({ queryKey: ["venue-day", venueId] });
      void client.invalidateQueries({
        queryKey: ["group-events", detail.data.event.group_id],
      });
      return data;
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return { upcoming, detail, roster, updateRsvp };
}
