import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventTypeFilter = 
  | 'all'
  | 'round_robin'
  | 'tournament'
  | 'open_play'
  | 'clinic'
  | 'league'
  | 'social';

export type DateRangeFilter = 'today' | 'this_week' | 'this_month' | 'all';

interface DiscoverEventsFilters {
  eventType?: EventTypeFilter;
  /**
   * Event types to exclude from results regardless of `eventType`.
   * Used by the player-side FindEvents to hide tournament events from the
   * player surface (tournaments live on the venue/organizer side now).
   * Has no effect when `eventType` is set to one of the excluded types
   * (the explicit user choice wins).
   */
  excludeEventTypes?: EventTypeFilter[];
  dateRange?: DateRangeFilter;
  state?: string;
  city?: string;
  skillMin?: number;
  skillMax?: number;
  limit?: number;
}

export interface DiscoverEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  status: string;
  visibility: string;
  start_time: string;
  end_time: string | null;
  max_participants: number | null;
  current_participants: number | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  price: number | null;
  host_type: string;
  host_venue_id: string | null;
  host_group_id: string | null;
  host_court_id: string | null;
  created_at: string;
  // Enriched fields
  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
  spots_left: number | null;
  is_full: boolean;
}

function getDateRangeStart(range: DateRangeFilter): Date {
  const now = new Date();
  switch (range) {
    case 'today':
      now.setHours(0, 0, 0, 0);
      return now;
    case 'this_week':
      const dayOfWeek = now.getDay();
      now.setDate(now.getDate() - dayOfWeek);
      now.setHours(0, 0, 0, 0);
      return now;
    case 'this_month':
      now.setDate(1);
      now.setHours(0, 0, 0, 0);
      return now;
    case 'all':
    default:
      return new Date(0);
  }
}

function getDateRangeEnd(range: DateRangeFilter): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      now.setHours(23, 59, 59, 999);
      return now;
    case 'this_week':
      const dayOfWeek = now.getDay();
      now.setDate(now.getDate() + (6 - dayOfWeek));
      now.setHours(23, 59, 59, 999);
      return now;
    case 'this_month':
      now.setMonth(now.getMonth() + 1);
      now.setDate(0);
      now.setHours(23, 59, 59, 999);
      return now;
    case 'all':
    default:
      return null;
  }
}

export function useDiscoverEvents(filters: DiscoverEventsFilters = {}) {
  const {
    eventType = 'all',
    excludeEventTypes,
    dateRange = 'all',
    state,
    city,
    skillMin,
    skillMax,
    limit = 50,
  } = filters;

  // Stable cache key for excludeEventTypes (sorted so caller order doesn't matter).
  const exclusionKey = excludeEventTypes ? [...excludeEventTypes].sort().join(',') : '';

  return useQuery({
    queryKey: ['discover-events', eventType, exclusionKey, dateRange, state, city, skillMin, skillMax, limit],
    queryFn: async (): Promise<DiscoverEvent[]> => {
      // Compute a single lower bound for start_time:
      //   - Always "now" (we never want past events in discovery)
      //   - For 'today' the dateRangeStart is 00:00 today, which is BEFORE
      //     now; clamping to max(now, dateRangeStart) prevents earlier-today
      //     events that have already started from leaking in.
      //   - For 'this_week' / 'this_month' early in the period, "now" is
      //     stricter; later in the period, dateRangeStart is stricter.
      const now = new Date();
      const dateRangeStart = dateRange !== 'all' ? getDateRangeStart(dateRange) : now;
      const lowerBound = dateRangeStart > now ? dateRangeStart : now;
      const upperBound = dateRange !== 'all' ? getDateRangeEnd(dateRange) : null;

      let query = supabase
        .from('unified_events')
        .select(`
          id,
          title,
          description,
          event_type,
          status,
          visibility,
          start_time,
          end_time,
          max_participants,
          current_participants,
          skill_level_min,
          skill_level_max,
          price,
          host_type,
          host_venue_id,
          host_group_id,
          host_court_id,
          created_at
        `)
        .eq('status', 'published')
        .eq('visibility', 'public')
        .gte('start_time', lowerBound.toISOString())
        .order('start_time', { ascending: true })
        .limit(limit);

      if (upperBound) {
        query = query.lte('start_time', upperBound.toISOString());
      }

      // Apply event type filter. An explicit `eventType` selection always
      // wins (the user picked that filter); the exclusion list only applies
      // when the caller is browsing the "all" view.
      if (eventType !== 'all') {
        query = query.eq('event_type', eventType);
      } else if (excludeEventTypes && excludeEventTypes.length > 0) {
        // PostgREST `not.in.(…)` excludes any rows whose event_type is in the list.
        const csv = excludeEventTypes.join(',');
        query = query.not('event_type', 'in', `(${csv})`);
      }

      // Apply skill level filters
      if (skillMin !== undefined) {
        query = query.gte('skill_level_min', skillMin);
      }
      if (skillMax !== undefined) {
        query = query.lte('skill_level_max', skillMax);
      }

      const { data: events, error } = await query;

      if (error) {
        console.error('Error fetching events:', error);
        throw error;
      }

      if (!events || events.length === 0) {
        return [];
      }

      // Get unique venue IDs to fetch venue info
      const venueIds = [...new Set(events
        .filter(e => e.host_venue_id)
        .map(e => e.host_venue_id as string)
      )];

      let venueMap: Record<string, { name: string; city: string | null; state: string | null }> = {};

      if (venueIds.length > 0) {
        const { data: venues } = await supabase
          .from('venues')
          .select('id, name, city, state')
          .in('id', venueIds);

        if (venues) {
          venueMap = venues.reduce((acc, v) => {
            acc[v.id] = { name: v.name, city: v.city, state: v.state };
            return acc;
          }, {} as Record<string, { name: string; city: string | null; state: string | null }>);
        }
      }

      // Enrich events with venue info and computed fields
      const enrichedEvents: DiscoverEvent[] = events.map(event => {
        const venue = event.host_venue_id ? venueMap[event.host_venue_id] : null;
        const spotsLeft = event.max_participants ? event.max_participants - (event.current_participants || 0) : null;
        
        return {
          ...event,
          venue_name: venue?.name,
          venue_city: venue?.city ?? undefined,
          venue_state: venue?.state ?? undefined,
          spots_left: spotsLeft,
          is_full: spotsLeft !== null && spotsLeft <= 0,
        };
      });

      // Apply location filters client-side (after venue enrichment)
      let filteredEvents = enrichedEvents;
      
      if (state) {
        filteredEvents = filteredEvents.filter(e => 
          e.venue_state?.toLowerCase() === state.toLowerCase()
        );
      }
      
      if (city) {
        filteredEvents = filteredEvents.filter(e => 
          e.venue_city?.toLowerCase().includes(city.toLowerCase())
        );
      }

      return filteredEvents;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook to get user's registered events
export function useMyRegisteredEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-registered-events', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          status,
          registered_at,
          event:unified_events (
            id,
            title,
            event_type,
            start_time,
            end_time,
            host_venue_id
          )
        `)
        .eq('user_id', userId)
        .in('status', ['registered', 'confirmed', 'waitlisted'])
        .order('registered_at', { ascending: false });

      if (error) {
        console.error('Error fetching registered events:', error);
        throw error;
      }

      return data || [];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

// Hook to get upcoming registered events for dashboard preview.
//
// Previously this used a single query with a PostgREST nested filter
//   .gte('unified_events.start_time', …)
// + ordering by a referenced table. That pattern is fragile: it depends on
// the FK relationship name being detectable by PostgREST, and silently
// returns nothing if the foreign-table filter can't be resolved.
//
// The hardened version fetches the user's active registrations in one query
// and applies the start_time filter + sort + limit client-side. The cost
// is small (a player has at most dozens of active registrations) and we
// no longer depend on a brittle nested filter.
export function useUpcomingRegisteredEvents(userId: string | undefined, limit = 3) {
  return useQuery({
    queryKey: ['upcoming-registered-events', userId, limit],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          id,
          status,
          registered_at,
          event:unified_events (
            id,
            title,
            event_type,
            start_time,
            end_time,
            host_venue_id
          )
        `)
        .eq('user_id', userId)
        .in('status', ['registered', 'confirmed']);

      if (error) {
        console.error('Error fetching upcoming events:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Filter to future-or-current events client-side, sort by start_time,
      // and trim to the caller's limit. Drop registrations whose join failed.
      const nowMs = Date.now();
      type RegRow = (typeof data)[number] & {
        event: {
          id: string;
          title: string;
          event_type: string;
          start_time: string;
          end_time: string | null;
          host_venue_id: string | null;
        } | null;
      };
      const upcoming = (data as RegRow[])
        .filter((r) => r.event && new Date(r.event.start_time).getTime() >= nowMs)
        .sort((a, b) =>
          new Date(a.event!.start_time).getTime() - new Date(b.event!.start_time).getTime()
        )
        .slice(0, limit);

      if (upcoming.length === 0) return [];

      // Enrich with venue names for the trimmed result set only.
      const venueIds = [...new Set(
        upcoming
          .map((r) => r.event?.host_venue_id)
          .filter((id): id is string => !!id)
      )];

      if (venueIds.length === 0) return upcoming;

      const { data: venues } = await supabase
        .from('venues')
        .select('id, name')
        .in('id', venueIds);

      const venueMap = (venues ?? []).reduce<Record<string, string>>((acc, v) => {
        acc[v.id] = v.name;
        return acc;
      }, {});

      return upcoming.map((r) => ({
        ...r,
        venue_name: r.event?.host_venue_id ? venueMap[r.event.host_venue_id] : undefined,
      }));
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
