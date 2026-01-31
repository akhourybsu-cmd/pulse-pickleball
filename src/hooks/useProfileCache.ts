import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CachedProfile {
  id: string;
  display_name: string | null;
  full_name: string;
  avatar_url: string | null;
  current_rating: number | null;
}

// Batch fetch profiles with deduplication
export function useProfiles(userIds: string[]) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean).sort();
  
  return useQuery({
    queryKey: ['profiles', uniqueIds.join(',')],
    queryFn: async () => {
      if (uniqueIds.length === 0) return new Map<string, CachedProfile>();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .in('id', uniqueIds);
      
      if (error) throw error;
      
      return new Map((data || []).map(p => [p.id, p as CachedProfile]));
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: uniqueIds.length > 0,
  });
}

// Single profile with cache
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data as CachedProfile;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!userId,
  });
}

// Hook to prefetch profiles
export function usePrefetchProfiles() {
  const queryClient = useQueryClient();
  
  return async (userIds: string[]) => {
    const uniqueIds = [...new Set(userIds)].filter(Boolean).sort();
    if (uniqueIds.length === 0) return;
    
    await queryClient.prefetchQuery({
      queryKey: ['profiles', uniqueIds.join(',')],
      queryFn: async () => {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, current_rating')
          .in('id', uniqueIds);
        
        return new Map((data || []).map(p => [p.id, p as CachedProfile]));
      },
      staleTime: 5 * 60 * 1000,
    });
  };
}
