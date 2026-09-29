import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDayGrid,
  courtsFreeAt,
  type Court,
  type Reservation,
} from "@/lib/venues/availability";
import {
  defaultVenueHours,
  gridOptionsFor,
  type VenueHours,
} from "@/lib/venues/hours";
import { useAuthState } from "@/hooks/useAuthState";
import { isConfirmedVenueRsvp } from "@/lib/venues/experience";
import type { GroupRsvpStatus } from "./useGroupEvents";
import { venueCalendarBounds, venueCalendarNow } from "@/lib/venues/timezone";

/**
 * One venue, one day: its courts, and everything scheduled on them.
 *
 * This is deliberately the ONLY place a venue's day is loaded. The player-facing
 * booking grid and the staff/ops dashboard that will sit alongside it are two
 * views of exactly the same question — "what is happening at this venue today"
 * — and the fastest way to end up with two products that disagree is to let
 * each fetch and shape its own answer. Both read this hook; permissions decide
 * actions and which booking details are visible; private bookings remain busy blocks.
 */

export interface VenueDaySession extends Reservation {
  venue_visit_id?: string | null;
  venue_appointment_id?: string | null;
  price_cents?: number;
  currency?: string;
  registration_paused?: boolean;
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  event_format: string;
  capacity: number | null;
  created_by: string | null;
  private_booking?: boolean;
  waitlist_enabled: boolean;
  parent_event_id: string | null;
  rotation_style?: string | null;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  rr_courts?: number | null;
}

/** A session on a court is a reservation; anything else is programming. */
export function isReservation(s: { event_format?: string | null }): boolean {
  return s.event_format === "reservation";
}

/** Operational child that allocates a court to one public venue program. */
export function isProgramHold(s: { event_format?: string | null }): boolean {
  return s.event_format === "program_hold";
}

/** Local midnight-to-midnight bounds for a day, as ISO strings. */
export function dayBounds(
  day: Date,
  timeZone?: string | null,
): { from: string; to: string } {
  return venueCalendarBounds(day, timeZone);
}

export function venueDayKey(venueId: string | null | undefined, day: Date) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return ["venue-day", venueId ?? null, d.toISOString()] as const;
}

export function useVenueDay(
  venueId: string | null | undefined,
  groupId: string | null | undefined,
  day: Date,
  /** The venue's own opening hours. Defaults only when none are stored. */
  hours: VenueHours = defaultVenueHours(),
  timeZone?: string | null,
) {
  const queryClient = useQueryClient();
  const { user } = useAuthState();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery({
    queryKey: [...venueDayKey(venueId, day), timeZone, user?.id],
    enabled: !!venueId && !!user,
    staleTime: 30 * 1000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { from, to } = dayBounds(day, timeZone);

      const [courtsRes, sessionsRes] = await Promise.all([
        supabase
          .from("venue_courts")
          .select("id, name, court_number, is_active, is_premium, surface_type")
          .eq("venue_id", venueId!)
          .order("court_number", { ascending: true }),
        (supabase as any).rpc("venue_calendar_sessions", {
          p_venue: venueId!,
          p_from: from,
          p_to: to,
        }),
      ]);

      if (courtsRes.error) throw courtsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      if (!Array.isArray(sessionsRes.data))
        throw new Error(
          "Court availability could not be confirmed. Please retry.",
        );
      const rawSessions = sessionsRes.data as VenueDaySession[];
      const parents = new Map(
        rawSessions.filter((s) => !isProgramHold(s)).map((s) => [s.id, s]),
      );
      const sessions = rawSessions.map((session) => {
        const parent = session.parent_event_id
          ? parents.get(session.parent_event_id)
          : null;
        return parent && isProgramHold(session)
          ? { ...session, title: parent.title, description: parent.description }
          : session;
      });
      const holdsResult = await (supabase as any).rpc("venue_checkout_holds", {
        p_venue: venueId!,
        p_from: from,
        p_to: to,
      });
      if (holdsResult.error) throw holdsResult.error;
      const holds = ((holdsResult.data ?? []) as Reservation[]).map((hold) => ({
        ...hold,
        event_format: "checkout_hold",
      }));

      // Sign-up counts for the programming only. Reservations and closures
      // have no spots to run out of, so counting them would mean a round trip
      // for numbers nothing displays.
      const joinable = sessions.filter(
        (s) =>
          !isReservation(s) &&
          !isProgramHold(s) &&
          s.event_format !== "maintenance",
      );
      let going: Record<string, number> = {};
      const viewerRsvpByEvent: Record<string, GroupRsvpStatus> = {};

      if (joinable.length > 0) {
        const { data: rsvps, error: rsvpError } = await supabase
          .from("group_event_rsvps")
          .select("event_id,user_id,status")
          .in(
            "event_id",
            joinable.map((s) => s.id),
          )
          .or(`status.eq.going,user_id.eq.${user!.id}`);

        if (rsvpError) throw rsvpError;

        going = (rsvps ?? []).reduce<Record<string, number>>((acc, r) => {
          if (r.status === "going")
            acc[r.event_id] = (acc[r.event_id] ?? 0) + 1;
          if (r.user_id === user!.id && isConfirmedVenueRsvp(r.status))
            viewerRsvpByEvent[r.event_id] = r.status;
          return acc;
        }, {});
      }

      return {
        courts: (courtsRes.data ?? []) as Court[],
        sessions,
        holds,
        going,
        viewerRsvpByEvent,
      };
    },
  });

  const courts = query.data?.courts ?? [];
  const sessions = useMemo(() => query.data?.sessions ?? [], [query.data]);
  const holds = useMemo(() => query.data?.holds ?? [], [query.data]);
  const going = useMemo(() => query.data?.going ?? {}, [query.data]);

  // Null on a day the venue is shut. An empty grid and a closed day look the
  // same to a renderer, so the difference is reported explicitly rather than
  // left for the UI to infer from "no rows".
  const gridOptions = useMemo(() => gridOptionsFor(hours, day), [hours, day]);
  const closed = gridOptions === null;

  const grid = useMemo(
    () =>
      gridOptions
        ? buildDayGrid(
            courts,
            [...sessions, ...(query.data?.holds ?? [])],
            day,
            { ...gridOptions, now, timeZone },
          )
        : [],
    // `courts` is derived from query.data, so keying on it directly is stable.
    [query.data, day, gridOptions, now, timeZone], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Programming — open play, clinics, round robins. Anything people can join.
   * Excludes court holds AND closures: a court taken out of service is not an
   * event, and advertising "Resurfacing" on the Play tab would be absurd.
   */
  const programming = useMemo(
    () =>
      sessions.filter(
        (s) =>
          !isReservation(s) &&
          !isProgramHold(s) &&
          s.event_format !== "maintenance",
      ),
    [sessions],
  );

  // A future day's schedule cannot answer how many courts are free right now.
  const freeNow = useMemo(() => {
    const localNow = venueCalendarNow(timeZone, now);
    if (
      query.isError ||
      query.isPending ||
      day.toDateString() !== localNow.toDateString()
    )
      return null;
    const todayHours = hours.days[localNow.getDay()];
    const minute = localNow.getHours() * 60 + localNow.getMinutes();
    if (
      !todayHours ||
      minute < todayHours.openMinutes ||
      minute >= todayHours.closeMinutes
    )
      return 0;
    return courtsFreeAt(
      courts,
      [...sessions, ...(query.data?.holds ?? [])],
      now,
    );
  }, [query.data, query.isError, query.isPending, day, now, hours, timeZone]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["venue-day", venueId] });
    void queryClient.invalidateQueries({ queryKey: ["group-events", groupId] });
    void queryClient.invalidateQueries({
      queryKey: ["venue-admin-counts", venueId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["venue-upcoming-programs", venueId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["venue-program", venueId],
    });
  }, [queryClient, venueId, groupId]);

  useEffect(() => {
    if (!venueId || !user?.id) return;
    const channel = supabase
      .channel(`venue-day-updates:${venueId}:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_events",
          filter: `venue_id=eq.${venueId}`,
        },
        refresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "venue_courts",
          filter: `venue_id=eq.${venueId}`,
        },
        refresh,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [venueId, user?.id, refresh]);

  return {
    courts,
    sessions,
    holds,
    going,
    viewerRsvpByEvent: query.data?.viewerRsvpByEvent ?? {},
    programming,
    grid,
    closed,
    slotMinutes: hours.slotMinutes,
    freeNow,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh,
    /** True once the venue has courts — what the Book tab is gated on. */
    hasCourts: courts.length > 0,
    groupId: groupId ?? null,
  };
}
