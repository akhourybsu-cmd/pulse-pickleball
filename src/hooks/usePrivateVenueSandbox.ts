import { useQuery } from '@tanstack/react-query';
import { useAuthState } from '@/hooks/useAuthState';
import { supabase } from '@/integrations/supabase/client';

/** Display metadata only. SQL enforces privacy and billing independently. */
export function usePrivateVenueSandbox(venueId?: string | null) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ['private-venue-sandbox', venueId, user?.id],
    enabled: !!venueId && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('private_venue_sandboxes')
        .select('venue_id').eq('venue_id', venueId).eq('owner_id', user!.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
  return query.data === true;
}

/** Navigation hint only; Edge Functions and SQL separately enforce test access. */
export function usePrivateVenuePaymentTesting(venueId?: string | null) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ['private-venue-test-payments', venueId, user?.id],
    enabled: !!venueId && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from('private_venue_sandboxes')
        .select('test_payments_enabled').eq('venue_id', venueId).eq('owner_id', user!.id).maybeSingle();
      if (error) throw error;
      return data?.test_payments_enabled === true;
    },
  });
  return query.data === true;
}
