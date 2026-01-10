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
    dateRange = 'all',
    state,
    city,
    skillMin,
    skillMax,
    limit = 50,
  } = filters;

  return useQuery({
    queryKey: ['discover-events', eventType, dateRange, state, city, skillMin, skillMax, limit],
    queryFn: async (): Promise<DiscoverEvent[]> => {
      // Build the query
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
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(limit);

      // Apply event type filter
      if (eventType !== 'all') {
        query = query.eq('event_type', eventType);
      }

      // Apply date range filter
      if (dateRange !== 'all') {
        const startDate = getDateRangeStart(dateRange);
        const endDate = getDateRangeEnd(dateRange);
        
        query = query.gte('start_time', startDate.toISOString());
        if (endDate) {
          query = query.lte('start_time', endDate.toISOString());
        }
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

// Hook to get upcoming registered events for dashboard preview
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
          event:unified_events!inner (
            id,
            title,
            event_type,
            start_time,
            end_time,
            host_venue_id
          )
        `)
        .eq('user_id', userId)
        .in('status', ['registered', 'confirmed'])
        .gte('unified_events.start_time', new Date().toISOString())
        .order('unified_events.start_time', { ascending: true, referencedTable: 'unified_events' })
        .limit(limit);

      if (error) {
        console.error('Error fetching upcoming events:', error);
        throw error;
      }

      // Fetch venue names for events
      if (data && data.length > 0) {
        const venueIds = [...new Set(
          data
            .map(r => (r.event as any)?.host_venue_id)
            .filter(Boolean)
        )];

        if (venueIds.length > 0) {
          const { data: venues } = await supabase
            .from('venues')
            .select('id, name')
            .in('id', venueIds);

          const venueMap = venues?.reduce((acc, v) => {
            acc[v.id] = v.name;
            return acc;
          }, {} as Record<string, string>) || {};

          return data.map(r => ({
            ...r,
            venue_name: (r.event as any)?.host_venue_id 
              ? venueMap[(r.event as any).host_venue_id] 
              : undefined
          }));
        }
      }

      return data || [];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}
