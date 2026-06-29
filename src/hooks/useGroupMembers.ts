import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GroupMemberWithProfile {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: 'active' | 'pending' | 'banned';
  joined_at: string;
  last_read_at: string | null;
  profile: {
    id: string;
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
    current_rating: number | null;
    /** Surfaced to fellow group members for tap-to-call/text from the roster.
     *  Null when the member hasn't set one. */
    phone_number: string | null;
  };
}

async function fetchGroupMembers(groupId: string): Promise<{ members: GroupMemberWithProfile[]; pendingMembers: GroupMemberWithProfile[] }> {
  // Fetch all members
  const { data: membersData, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  // Fetch profiles
  const userIds = (membersData || []).map(m => m.user_id);
  const { data: profilesData } = await supabase
    .from('profiles_public')
    .select('id, display_name, full_name, avatar_url, current_rating')
    .in('id', userIds);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  const membersWithProfiles: GroupMemberWithProfile[] = (membersData || [])
    .filter(m => profilesMap.has(m.user_id))
    .map(m => {
      const profile = profilesMap.get(m.user_id);
      return {
        ...m,
        status: m.status as 'active' | 'pending' | 'banned',
        profile: profile
          ? { ...profile, phone_number: null }
          : {
              id: m.user_id,
              display_name: null,
              full_name: 'Player',
              avatar_url: null,
              current_rating: null,
              phone_number: null,
            },
      };
    });

  return {
    members: membersWithProfiles.filter(m => m.status === 'active'),
    pendingMembers: membersWithProfiles.filter(m => m.status === 'pending'),
  };
}

export function useGroupMembers(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, refetch } = useQuery({
    queryKey: ['group-members', groupId],
    queryFn: () => fetchGroupMembers(groupId!),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!groupId,
  });

  const members = data?.members || [];
  const pendingMembers = data?.pendingMembers || [];

  // Shared cache key + helper. Member mutations used to invalidate the
  // entire ['group-members', groupId] on every action — for a 100+
  // member roster that's a full re-fetch on every approve/role-change.
  // Now we patch in place and rely on the realtime subscription
  // (useGroupRealtime) + 1-min staleTime to converge on server truth.
  const cacheKey = ['group-members', groupId];
  type CacheShape = { members: GroupMemberWithProfile[]; pendingMembers: GroupMemberWithProfile[] };
  const patchCache = (mutator: (prev: CacheShape) => CacheShape) => {
    const prev = queryClient.getQueryData<CacheShape>(cacheKey);
    if (!prev) return undefined;
    queryClient.setQueryData<CacheShape>(cacheKey, mutator(prev));
    return prev;
  };

  const approveMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('id', memberId);

      if (error) throw error;
    },
    onMutate: (memberId) =>
      ({
        prev: patchCache((p) => {
          const target = p.pendingMembers.find((m) => m.id === memberId);
          if (!target) return p;
          return {
            members: [...p.members, { ...target, status: 'active' }],
            pendingMembers: p.pendingMembers.filter((m) => m.id !== memberId),
          };
        }),
      }),
    onSuccess: () => {
      toast({ title: 'Approved', description: 'Member has been approved' });
    },
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cacheKey, ctx.prev);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve member',
        variant: 'destructive',
      });
    },
  });

  const rejectMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onMutate: (memberId) =>
      ({
        prev: patchCache((p) => ({
          ...p,
          pendingMembers: p.pendingMembers.filter((m) => m.id !== memberId),
        })),
      }),
    onSuccess: () => {
      toast({ title: 'Rejected', description: 'Join request has been rejected' });
    },
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cacheKey, ctx.prev);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject member',
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: 'moderator' | 'member' }) => {
      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
      return role;
    },
    onMutate: ({ memberId, role }) =>
      ({
        prev: patchCache((p) => ({
          ...p,
          members: p.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        })),
      }),
    onSuccess: (role) => {
      toast({
        title: 'Role Updated',
        description: `Member is now a ${role}`,
      });
    },
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cacheKey, ctx.prev);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onMutate: (memberId) =>
      ({
        prev: patchCache((p) => ({
          ...p,
          members: p.members.filter((m) => m.id !== memberId),
        })),
      }),
    onSuccess: () => {
      toast({ title: 'Removed', description: 'Member has been removed from the group' });
    },
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cacheKey, ctx.prev);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
    },
  });

  const banMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'banned' })
        .eq('id', memberId);

      if (error) throw error;
    },
    onMutate: (memberId) =>
      ({
        // Banned members drop out of both visible lists (members filter
        // is status='active', pendingMembers is status='pending').
        prev: patchCache((p) => ({
          members: p.members.filter((m) => m.id !== memberId),
          pendingMembers: p.pendingMembers.filter((m) => m.id !== memberId),
        })),
      }),
    onSuccess: () => {
      toast({ title: 'Banned', description: 'Member has been banned from the group' });
    },
    onError: (error: any, _v, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(cacheKey, ctx.prev);
      toast({
        title: 'Error',
        description: error.message || 'Failed to ban member',
        variant: 'destructive',
      });
    },
  });

  return {
    members,
    pendingMembers,
    loading,
    approveMember: approveMemberMutation.mutateAsync,
    rejectMember: rejectMemberMutation.mutateAsync,
    updateRole: (memberId: string, role: 'moderator' | 'member') => 
      updateRoleMutation.mutateAsync({ memberId, role }),
    removeMember: removeMemberMutation.mutateAsync,
    banMember: banMemberMutation.mutateAsync,
    refetch,
  };
}
