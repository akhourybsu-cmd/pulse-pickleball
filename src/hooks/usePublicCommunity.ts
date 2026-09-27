import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Group } from './useGroups';

export interface PublicCommunity {
  id: string;
  name: string;
  description: string | null;
  visibility: 'public';
  join_method: Group['join_method'];
  icon_url: string | null;
  cover_url: string | null;
  member_count: number;
  is_venue_verified: boolean;
  venue: (NonNullable<Group['venue']> & { address: string | null; booking_enabled: boolean }) | null;
  courts: { id: string; name: string | null; court_number: number; court_type: string | null; surface_type: string | null }[];
}

export function usePublicCommunity(groupId?: string, slug?: string) {
  return useQuery({
    queryKey: ['public-community', groupId, slug],
    enabled: !!(groupId || slug),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_community', { p_group_id: groupId || null, p_venue_slug: slug || null });
      if (error) throw error;
      return data as unknown as PublicCommunity | null;
    },
  });
}

export function usePublicCommunities(search: string, page: number) {
  return useQuery({
    queryKey: ['public-communities', search, page],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_public_communities', { p_search: search, p_offset: page * 24 });
      if (error) throw error;
      return (data || []) as unknown as PublicCommunity[];
    },
  });
}
