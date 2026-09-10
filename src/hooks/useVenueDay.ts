import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  buildDayGrid,
  courtsFreeAt,
  type Court,
  type Reservation,
} from '@/lib/venues/availability';
import { defaultVenueHours, gridOptionsFor, type VenueHours } from '@/lib/venues/hours';
import { useAuthState } from '@/hooks/useAuthState';
import { venueDayOverlapFilter } from '@/lib/venues/experience';

/**
 * One venue, one day: its courts, and everything scheduled on them.
 *
 * This is deliberately the ONLY place a venue's day is loaded. The player-facing
 * booking grid and the staff/ops dashboard that will sit alongside it are two
 * views of exactly the same question — "what is happening at this venue today"
 * — and the fastest way to end up with two products that disagree is to let
 * each fetch and shape its own answer. Both read this hook; permissions decide
 * what they may do with it, not what they may see.
 */

export interface VenueDaySession extends Reservation {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  event_format: string;
  capacity: number | null;
  created_by: string;
  waitlist_enabled: boolean;
  parent_event_id: string | null;
  rotation_style?: string | null;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  rr_courts?: number | null;
}

/** A session on a court is a reservation; anything else is programming. */
export function isReservation(s: { event_format?: string | null }): boolean {
  return s.event_format === 'reservation';
}

/** Operational child that allocates a court to one public venue program. */
export function isProgramHold(s: { event_format?: string | null }): boolean {
  return s.event_format === 'program_hold';
}

/** Local midnight-to-midnight bounds for a day, as ISO strings. */
export function dayBounds(day: Date): { from: string; to: string } {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function venueDayKey(venueId: string | null | undefined, day: Date) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  return ['venue-day', venueId ?? null, d.toISOString()] as const;
}

export function useVenueDay(
  venueId: string | null | undefined,
  groupId: string | null | undefined,
  day: Date,
  /** The venue's own opening hours. Defaults only when none are stored. */
  hours: VenueHours = defaultVenueHours(),
) {
  const queryClient = useQueryClient();
  const { user } = useAuthState();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const query = useQuery({
    queryKey: [...venueDayKey(venueId, day), user?.id],
    enabled: !!venueId && !!user,
    staleTime: 30 * 1000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { from, to } = dayBounds(day);

      const [courtsRes, sessionsRes] = await Promise.all([
        supabase
          .from('venue_courts')
          .select('id, name, court_number, is_active, is_premium, surface_type')
          .eq('venue_id', venueId!)
          .order('court_number', { ascending: true }),
        // Scoped by venue rather than by group: a venue's courts can carry
        // sessions from more than one group (a league using the facility), and
        // the grid has to show every one of them or it will offer a slot that
        // is already taken.
        supabase
          .from('group_events')
          .select('id, group_id, title, description, event_format, capacity, created_by, waitlist_enabled, start_time, end_time, venue_court_id, parent_event_id, rotation_style, skill_level_min, skill_level_max, rr_courts')
          .eq('venue_id', venueId!)
          .lt('start_time', to)
          .or(venueDayOverlapFilter(from))
          .order('start_time', { ascending: true }),
      ]);

      if (courtsRes.error) throw courtsRes.error;
      if (sessionsRes.error) throw sessionsRes.error;

      const rawSessions = (sessionsRes.data ?? []) as VenueDaySession[];
      const parents = new Map(rawSessions.filter(s => !isProgramHold(s)).map(s => [s.id, s]));
      const sessions = rawSessions.map(session => {
        const parent = session.parent_event_id ? parents.get(session.parent_event_id) : null;
        return parent && isProgramHold(session) ? { ...session, title: parent.title, description: parent.description } : session;
      });
      const holdsResult = await (supabase as any).rpc('venue_checkout_holds', { p_venue: venueId!, p_from: from, p_to: to });
      if (holdsResult.error) throw holdsResult.error;
      const holds = (holdsResult.data ?? []) as Reservation[];

      // Sign-up counts for the programming only. Reservations and closures
      // have no spots to run out of, so counting them would mean a round trip
      // for numbers nothing displays.
      const joinable = sessions.filter(
        (s) => !isReservation(s) && !isProgramHold(s) && s.event_format !== 'maintenance',
      );
      let going: Record<string, number> = {};

      if (joinable.length > 0) {
        const { data: rsvps, error: rsvpError } = await supabase
          .from('group_event_rsvps')
          .select('event_id')
          .in('event_id', joinable.map((s) => s.id))
          .eq('status', 'going');

        if (rsvpError) throw rsvpError;

        going = (rsvps ?? []).reduce<Record<string, number>>((acc, r) => {
          acc[r.event_id] = (acc[r.event_id] ?? 0) + 1;
          return acc;
        }, {});
      }

      return {
        courts: (courtsRes.data ?? []) as Court[],
        sessions,
        holds,
        going,
      };
    },
  });

  const courts = query.data?.courts ?? [];
  const sessions = useMemo(() => query.data?.sessions ?? [], [query.data]);
  const going = useMemo(() => query.data?.going ?? {}, [query.data]);

  // Null on a day the venue is shut. An empty grid and a closed day look the
  // same to a renderer, so the difference is reported explicitly rather than
  // left for the UI to infer from "no rows".
  const gridOptions = useMemo(() => gridOptionsFor(hours, day), [hours, day]);
  const closed = gridOptions === null;

  const grid = useMemo(
    () => (gridOptions ? buildDayGrid(courts, [...sessions, ...(query.data?.holds ?? [])], day, { ...gridOptions, now }) : []),
    // `courts` is derived from query.data, so keying on it directly is stable.
    [query.data, day, gridOptions, now], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /**
   * Programming — open play, clinics, round robins. Anything people can join.
   * Excludes court holds AND closures: a court taken out of service is not an
   * event, and advertising "Resurfacing" on the Play tab would be absurd.
   */
  const programming = useMemo(
    () => sessions.filter(
      (s) => !isReservation(s) && !isProgramHold(s) && s.event_format !== 'maintenance',
    ),
    [sessions],
  );

  // A future day's schedule cannot answer how many courts are free right now.
  const freeNow = useMemo(() => {
    if (query.isError || query.isPending || day.toDateString() !== now.toDateString()) return null;
    const todayHours = hours.days[now.getDay()];
    const minute = now.getHours() * 60 + now.getMinutes();
    if (!todayHours || minute < todayHours.openMinutes || minute >= todayHours.closeMinutes) return 0;
    return courtsFreeAt(courts, [...sessions, ...(query.data?.holds ?? [])], now);
  }, [query.data, query.isError, query.isPending, day, now, hours]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['venue-day', venueId] });
    void queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
    void queryClient.invalidateQueries({ queryKey: ['venue-admin-counts', venueId] });
  }, [queryClient, venueId, groupId]);

  useEffect(() => {
    if (!venueId || !user?.id) return;
    const channel = supabase.channel(`venue-day-updates:${venueId}:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_events', filter: `venue_id=eq.${venueId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_courts', filter: `venue_id=eq.${venueId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [venueId, user?.id, refresh]);

  return {
    courts,
    sessions,
    going,
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
