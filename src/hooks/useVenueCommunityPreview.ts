import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthState } from './useAuthState';

export interface ClubPlayer { id: string; display_name: string | null; full_name: string; avatar_url: string | null }

export async function fetchVenueCommunityPreview(groupId: string): Promise<ClubPlayer[]> {
  const { data, error } = await supabase.from('group_members').select('user_id').eq('group_id', groupId).eq('status', 'active').order('joined_at').limit(4);
  if (error) throw error;
  if (!data?.length) return [];
  const ids = data.map(row => row.user_id);
  const profiles = await supabase.from('profiles_public').select('id,display_name,full_name,avatar_url').in('id', ids);
  if (profiles.error) throw profiles.error;
  return ids.flatMap(id => profiles.data?.filter(profile => profile.id === id) ?? []);
}

export function useVenueCommunityPreview(groupId: string | undefined, enabled: boolean) {
  const { user } = useAuthState();
  return useQuery({ queryKey: ['venue-community-preview', groupId, user?.id], enabled: enabled && !!groupId && !!user,
    queryFn: () => fetchVenueCommunityPreview(groupId!), staleTime: 60_000 });
}
