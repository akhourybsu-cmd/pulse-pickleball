import { useState, useEffect, useCallback } from 'react';
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
  };
}

export function useGroupMembers(groupId: string | undefined) {
  const [members, setMembers] = useState<GroupMemberWithProfile[]>([]);
  const [pendingMembers, setPendingMembers] = useState<GroupMemberWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchMembers = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
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
        .select('id, display_name, full_name, avatar_url, current_rating')
        .in('id', userIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const membersWithProfiles: GroupMemberWithProfile[] = (membersData || [])
        .filter(m => profilesMap.has(m.user_id))
        .map(m => ({
          ...m,
          status: m.status as 'active' | 'pending' | 'banned',
          profile: profilesMap.get(m.user_id)!,
        }));

      // Separate active and pending
      setMembers(membersWithProfiles.filter(m => m.status === 'active'));
      setPendingMembers(membersWithProfiles.filter(m => m.status === 'pending'));
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: 'Error',
        description: 'Failed to load members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_members_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        () => fetchMembers()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchMembers]);

  const approveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'active' })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Approved', description: 'Member has been approved' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error('Error approving member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve member',
        variant: 'destructive',
      });
      return false;
    }
  };

  const rejectMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Rejected', description: 'Join request has been rejected' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error('Error rejecting member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to reject member',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateRole = async (memberId: string, role: 'moderator' | 'member') => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;

      toast({ 
        title: 'Role Updated', 
        description: `Member is now a ${role}` 
      });
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive',
      });
      return false;
    }
  };

  const removeMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Removed', description: 'Member has been removed from the group' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove member',
        variant: 'destructive',
      });
      return false;
    }
  };

  const banMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ status: 'banned' })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Banned', description: 'Member has been banned from the group' });
      await fetchMembers();
      return true;
    } catch (error: any) {
      console.error('Error banning member:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to ban member',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    members,
    pendingMembers,
    loading,
    approveMember,
    rejectMember,
    updateRole,
    removeMember,
    banMember,
    refetch: fetchMembers,
  };
}
