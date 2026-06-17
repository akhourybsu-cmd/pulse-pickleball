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
    .from('profiles')
    .select('id, display_name, full_name, avatar_url, current_rating, phone_number')
    .in('id', userIds);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  const membersWithProfiles: GroupMemberWithProfile[] = (membersData || [])
    .filter(m => profilesMap.has(m.user_id))
    .map(m => ({
      ...m,
      status: m.status as 'active' | 'pending' | 'banned',
      profile: profilesMap.get(m.user_id)!,
    }));

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

  const approveMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Approved', description: 'Member has been approved' });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      console.error('Error approving member:', error);
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
    onSuccess: () => {
      toast({ title: 'Rejected', description: 'Join request has been rejected' });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      console.error('Error rejecting member:', error);
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
    onSuccess: (role) => {
      toast({ 
        title: 'Role Updated', 
        description: `Member is now a ${role}` 
      });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      console.error('Error updating role:', error);
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
    onSuccess: () => {
      toast({ title: 'Removed', description: 'Member has been removed from the group' });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      console.error('Error removing member:', error);
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
    onSuccess: () => {
      toast({ title: 'Banned', description: 'Member has been banned from the group' });
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
    },
    onError: (error: any) => {
      console.error('Error banning member:', error);
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
