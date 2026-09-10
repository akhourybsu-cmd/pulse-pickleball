import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listVenueModules, hasVenueModule } from '@/lib/venues/venueApplications';
import { nextVenueAccessChange } from '@/lib/venues/moduleExperience';

export function useVenueModules(venueId?: string | null) {
  const [clock, setClock] = useState(Date.now);
  const query = useQuery({
    queryKey: ['venue-modules', venueId], enabled: !!venueId,
    queryFn: () => listVenueModules(venueId!), staleTime: 30_000, refetchInterval: 60_000,
  });
  const rows = query.data ?? [];
  useEffect(() => {
    const delay = nextVenueAccessChange(query.data ?? []);
    if (delay == null) return;
    const timer = setTimeout(() => setClock(Date.now()), delay);
    return () => clearTimeout(timer);
  }, [query.data, clock, venueId]);
  return { ...query, booking: !query.isError && hasVenueModule(rows, 'court_booking'), facility: !query.isError && hasVenueModule(rows, 'facility_tools'),
    loading: !!venueId && query.isPending, existingAccess: rows.some(r => r.source === 'existing_venue') };
}
