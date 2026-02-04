import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addDays, addMonths, startOfDay, endOfDay } from "date-fns";

export type DateRangeFilter = 'this_week' | 'this_month' | 'next_3_months' | 'all';
export type RegistrationStatus = 'open' | 'opening_soon' | 'all';

export interface BrowseTournamentFilters {
  search?: string;
  location?: string;
  dateRange?: DateRangeFilter;
  registrationStatus?: RegistrationStatus;
}

export interface BrowseTournament {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_state: string | null;
  start_date: string;
  end_date: string;
  status: string;
  divisions_count: number;
  registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  slug: string | null;
}

export function useBrowseTournaments(filters: BrowseTournamentFilters) {
  const [tournaments, setTournaments] = useState<BrowseTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("tournaments_events")
          .select(`
            id,
            name,
            description,
            location,
            start_date,
            end_date,
            status,
            divisions_count,
            registration_enabled,
            registration_open_date,
            registration_close_date,
            registration_fee,
            slug,
            venues:venue_id (
              name,
              city,
              state
            )
          `)
          .eq("public_view_enabled", true)
          .gte("start_date", new Date().toISOString().split('T')[0])
          .order("start_date", { ascending: true });

        // Apply date range filter
        if (filters.dateRange && filters.dateRange !== 'all') {
          const now = new Date();
          let endDate: Date;

          switch (filters.dateRange) {
            case 'this_week':
              endDate = addDays(now, 7);
              break;
            case 'this_month':
              endDate = addMonths(now, 1);
              break;
            case 'next_3_months':
              endDate = addMonths(now, 3);
              break;
            default:
              endDate = addMonths(now, 12);
          }

          query = query.lte("start_date", endDate.toISOString().split('T')[0]);
        }

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;

        // Transform and filter data
        let transformedData: BrowseTournament[] = (data || []).map((event: any) => ({
          id: event.id,
          name: event.name,
          description: event.description,
          location: event.location,
          venue_name: event.venues?.name || null,
          venue_city: event.venues?.city || null,
          venue_state: event.venues?.state || null,
          start_date: event.start_date,
          end_date: event.end_date,
          status: event.status,
          divisions_count: event.divisions_count || 0,
          registration_enabled: event.registration_enabled,
          registration_open_date: event.registration_open_date,
          registration_close_date: event.registration_close_date,
          registration_fee: event.registration_fee || 0,
          slug: event.slug,
        }));

        // Apply search filter (client-side)
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          transformedData = transformedData.filter(t =>
            t.name.toLowerCase().includes(searchLower) ||
            t.location?.toLowerCase().includes(searchLower) ||
            t.venue_name?.toLowerCase().includes(searchLower) ||
            t.venue_city?.toLowerCase().includes(searchLower) ||
            t.venue_state?.toLowerCase().includes(searchLower)
          );
        }

        // Apply location filter (client-side)
        if (filters.location) {
          const locationLower = filters.location.toLowerCase();
          transformedData = transformedData.filter(t =>
            t.location?.toLowerCase().includes(locationLower) ||
            t.venue_city?.toLowerCase().includes(locationLower) ||
            t.venue_state?.toLowerCase().includes(locationLower)
          );
        }

        // Apply registration status filter (client-side)
        if (filters.registrationStatus && filters.registrationStatus !== 'all') {
          const now = new Date();
          transformedData = transformedData.filter(t => {
            const openDate = t.registration_open_date ? new Date(t.registration_open_date) : null;
            const closeDate = t.registration_close_date ? new Date(t.registration_close_date) : null;

            if (filters.registrationStatus === 'open') {
              const isOpen = (!openDate || openDate <= now) && (!closeDate || closeDate >= now) && t.registration_enabled;
              return isOpen;
            }
            if (filters.registrationStatus === 'opening_soon') {
              return openDate && openDate > now;
            }
            return true;
          });
        }

        setTournaments(transformedData);
      } catch (err) {
        setError(err as Error);
        console.error("Error fetching tournaments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [filters.search, filters.location, filters.dateRange, filters.registrationStatus]);

  return { tournaments, loading, error };
}

export function getRegistrationStatus(tournament: BrowseTournament): 'open' | 'closed' | 'opening_soon' {
  const now = new Date();
  const openDate = tournament.registration_open_date ? new Date(tournament.registration_open_date) : null;
  const closeDate = tournament.registration_close_date ? new Date(tournament.registration_close_date) : null;

  if (openDate && openDate > now) {
    return 'opening_soon';
  }
  if (closeDate && closeDate < now) {
    return 'closed';
  }
  if (!tournament.registration_enabled) {
    return 'closed';
  }
  return 'open';
}
