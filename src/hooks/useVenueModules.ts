import { useQuery } from '@tanstack/react-query';
import { listVenueModules, hasVenueModule } from '@/lib/venues/venueApplications';

export function useVenueModules(venueId?: string | null) {
  const query = useQuery({
    queryKey: ['venue-modules', venueId], enabled: !!venueId,
    queryFn: () => listVenueModules(venueId!), staleTime: 30_000, refetchInterval: 60_000,
  });
  const rows = query.data ?? [];
  return { ...query, booking: hasVenueModule(rows, 'court_booking'), facility: hasVenueModule(rows, 'facility_tools'),
    loading: !!venueId && query.isPending, existingAccess: rows.some(r => r.source === 'existing_venue') };
}
