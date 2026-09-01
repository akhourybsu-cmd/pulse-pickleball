import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mergeBookings, splitBookings, type BookingSource } from '@/lib/venues/bookings';

/**
 * Everything the signed-in player has booked, across every venue.
 *
 * Two queries because there are genuinely two relationships — courts you hold
 * and sessions you signed up for — and they live in different tables. They are
 * merged and de-duplicated in `lib/venues/bookings`, which is where the rules
 * are tested.
 */

const EVENT_SELECT =
  'id, group_id, title, event_format, start_time, end_time, ' +
  'venues:venue_id (name), venue_courts:venue_court_id (name, court_number)';

/** Flatten the joined venue/court names onto the row. */
function shape(row: any, rsvpStatus?: string | null): BookingSource {
  const court = row.venue_courts;
  return {
    id: row.id,
    group_id: row.group_id,
    title: row.title,
    event_format: row.event_format,
    start_time: row.start_time,
    end_time: row.end_time,
    venue_name: row.venues?.name ?? null,
    court_name: court ? (court.name ?? `Court ${court.court_number}`) : null,
    rsvp_status: rsvpStatus ?? null,
  };
}

export const MY_BOOKINGS_KEY = ['my-bookings'] as const;

export function useMyBookings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MY_BOOKINGS_KEY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('not-authenticated');

      const [mine, rsvps] = await Promise.all([
        // Courts held. Only sessions tied to an actual court — a group event
        // someone happened to create is not a booking of theirs.
        supabase
          .from('group_events')
          .select(EVENT_SELECT)
          .eq('created_by', user.id)
          .not('venue_court_id', 'is', null)
          .neq('event_format', 'maintenance')
          .order('start_time', { ascending: true }),
        supabase
          .from('group_event_rsvps')
          .select(`status, group_events!inner (${EVENT_SELECT})`)
          .eq('user_id', user.id)
          .in('status', ['going', 'waitlist']),
      ]);

      if (mine.error) throw mine.error;
      if (rsvps.error) throw rsvps.error;

      const reservations = (mine.data ?? []).map((row) => shape(row));
      const signups = (rsvps.data ?? [])
        .filter((row: any) => !!row.group_events)
        .map((row: any) => shape(row.group_events, row.status));

      return { userId: user.id, entries: mergeBookings(reservations, signups) };
    },
  });

  const entries = useMemo(() => query.data?.entries ?? [], [query.data]);
  const { upcoming, past } = useMemo(() => splitBookings(entries), [entries]);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: MY_BOOKINGS_KEY });
  }, [queryClient]);

  return {
    upcoming,
    past,
    userId: query.data?.userId ?? null,
    loading: query.isLoading,
    error: query.error as Error | null,
    refresh,
  };
}
