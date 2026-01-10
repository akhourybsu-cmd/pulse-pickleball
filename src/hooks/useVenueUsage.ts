/**
 * Hook for fetching venue usage counts (events, courts, coaches)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth } from "date-fns";

interface VenueUsage {
  eventsThisMonth: number;
  totalCourts: number;
  totalCoaches: number;
}

interface UseVenueUsageOptions {
  venueId: string | null;
}

export function useVenueUsage({ venueId }: UseVenueUsageOptions) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['venue-usage', venueId],
    queryFn: async (): Promise<VenueUsage> => {
      if (!venueId) {
        return { eventsThisMonth: 0, totalCourts: 0, totalCoaches: 0 };
      }

      // Get current month boundaries
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      // Fetch all counts in parallel
      const [eventsResult, courtsResult, coachesResult] = await Promise.all([
        // Count events created this month for this venue
        supabase
          .from('unified_events')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId)
          .gte('created_at', monthStart)
          .lte('created_at', monthEnd),
        
        // Count courts for this venue
        supabase
          .from('venue_courts')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId),
        
        // Count coaches for this venue
        supabase
          .from('venue_coaches')
          .select('id', { count: 'exact', head: true })
          .eq('venue_id', venueId),
      ]);

      // Handle errors gracefully - return 0 if table doesn't exist or other error
      const eventsCount = eventsResult.error ? 0 : (eventsResult.count ?? 0);
      const courtsCount = courtsResult.error ? 0 : (courtsResult.count ?? 0);
      const coachesCount = coachesResult.error ? 0 : (coachesResult.count ?? 0);

      return {
        eventsThisMonth: eventsCount,
        totalCourts: courtsCount,
        totalCoaches: coachesCount,
      };
    },
    enabled: !!venueId,
    staleTime: 30000, // Cache for 30 seconds
  });

  return {
    usage: data ?? { eventsThisMonth: 0, totalCourts: 0, totalCoaches: 0 },
    isLoading,
    error,
    refetch,
  };
}
