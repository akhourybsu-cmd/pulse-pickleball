import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Group, GroupMember } from '@/hooks/useGroups';

/**
 * A group plus the viewer's membership.
 *
 * Extracted so the standard community page, the venue shell and the route that
 * chooses between them all read the SAME query under the SAME key. React Query
 * then serves the second and third from cache, so dispatching on group type
 * costs nothing, and no surface can end up with a stale or differently-shaped
 * copy of the group.
 */

export const GROUP_DETAIL_KEY = (groupId: string | undefined) => ['group-detail', groupId] as const;

export const GROUP_VENUE_SELECT =
  '*, venues:venue_id (id, name, slug, logo_url, cover_image_url, primary_color, ' +
  'secondary_color, tagline, welcome_headline, welcome_message, city, state, phone, ' +
  'email, website_url, hours_of_operation)';

export function useGroupDetail(groupId: string | undefined) {
  const query = useQuery({
    queryKey: GROUP_DETAIL_KEY(groupId),
    enabled: !!groupId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('not-authenticated');

      // Group and membership are independent, so they go in parallel.
      // maybeSingle on membership: a non-member legitimately has zero rows and
      // single() would treat that as an error.
      const [groupRes, memberRes] = await Promise.all([
        supabase.from('groups').select(GROUP_VENUE_SELECT).eq('id', groupId!).single(),
        supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupId!)
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (groupRes.error) throw groupRes.error;

      const group = {
        ...(groupRes.data as any),
        venue: (groupRes.data as any).venues || null,
      } as Group;

      return { group, membership: (memberRes.data as GroupMember | null) ?? null };
    },
  });

  return {
    group: query.data?.group ?? null,
    membership: query.data?.membership ?? null,
    loading: query.isLoading,
    isError: query.isError,
  };
}
