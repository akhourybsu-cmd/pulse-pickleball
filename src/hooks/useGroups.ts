import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  type: 'crew' | 'league' | 'open_play' | 'venue_official' | 'tournament';
  visibility: 'public' | 'unlisted' | 'private';
  join_method: 'open' | 'request_to_join' | 'invite_only';
  invite_code: string | null;
  cover_url: string | null;
  icon_url: string | null;
  venue_id: string | null;
  court_id: string | null;
  created_by: string;
  settings: Json;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: string;
  last_read_at: string;
  joined_at: string;
  profile?: {
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface GroupWithMembership extends Group {
  membership?: GroupMember;
  unread_count?: number;
}

export function useGroups() {
  const [myGroups, setMyGroups] = useState<GroupWithMembership[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchMyGroups();
      fetchPublicGroups();
    }
  }, [currentUserId]);

  const fetchMyGroups = async () => {
    if (!currentUserId) return;
    
    setLoading(true);
    try {
      // Get groups where user is a member
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select(`
          *,
          groups (*)
        `)
        .eq('user_id', currentUserId)
        .eq('status', 'active');

      if (memberError) throw memberError;

      const groups: GroupWithMembership[] = (memberships || [])
        .filter((m: any) => m.groups)
        .map((m: any) => ({
          ...m.groups,
          membership: {
            id: m.id,
            group_id: m.group_id,
            user_id: m.user_id,
            role: m.role,
            status: m.status,
            last_read_at: m.last_read_at,
            joined_at: m.joined_at,
          },
        }));

      // Calculate unread counts for each group
      for (const group of groups) {
        if (group.membership?.last_read_at) {
          const { count } = await supabase
            .from('group_posts')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .gt('created_at', group.membership.last_read_at);
          
          group.unread_count = count || 0;
        }
      }

      // Sort: groups with unread first, then by recent activity
      groups.sort((a, b) => {
        if ((a.unread_count || 0) > 0 && (b.unread_count || 0) === 0) return -1;
        if ((a.unread_count || 0) === 0 && (b.unread_count || 0) > 0) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setMyGroups(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load your groups',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('visibility', 'public')
        .order('member_count', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPublicGroups(data || []);
    } catch (error) {
      console.error('Error fetching public groups:', error);
    }
  };

  const createGroup = async (groupData: {
    name: string;
    description?: string;
    type: Group['type'];
    visibility: Group['visibility'];
    join_method: Group['join_method'];
  }) => {
    if (!currentUserId) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          ...groupData,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Success', description: `${groupData.name} has been created!` });
      await fetchMyGroups();
      return data;
    } catch (error: any) {
      console.error('Error creating group:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create group',
        variant: 'destructive',
      });
      return null;
    }
  };

  const joinGroupByCode = async (code: string) => {
    if (!currentUserId) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return null;
    }

    try {
      // Find group by invite code
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code.toUpperCase().trim())
        .single();

      if (findError || !group) {
        toast({ title: 'Not Found', description: 'Invalid group code', variant: 'destructive' });
        return null;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', currentUserId)
        .single();

      if (existingMember) {
        if (existingMember.status === 'active') {
          toast({ title: 'Already a Member', description: 'You are already in this group' });
          return group;
        }
        if (existingMember.status === 'banned') {
          toast({ title: 'Access Denied', description: 'You have been banned from this group', variant: 'destructive' });
          return null;
        }
        if (existingMember.status === 'pending') {
          toast({ title: 'Pending', description: 'Your join request is still pending' });
          return group;
        }
      }

      // Check join method
      if (group.join_method === 'invite_only') {
        toast({ title: 'Invite Only', description: 'This group requires an invitation', variant: 'destructive' });
        return null;
      }

      const status = group.join_method === 'request_to_join' ? 'pending' : 'active';

      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: currentUserId,
          role: 'member',
          status,
        });

      if (joinError) throw joinError;

      if (status === 'pending') {
        toast({ title: 'Request Sent', description: 'Your join request has been sent to the group admins' });
      } else {
        toast({ title: 'Joined!', description: `Welcome to ${group.name}!` });
        await fetchMyGroups();
      }

      return group;
    } catch (error: any) {
      console.error('Error joining group:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to join group',
        variant: 'destructive',
      });
      return null;
    }
  };

  const leaveGroup = async (groupId: string) => {
    if (!currentUserId) return false;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      toast({ title: 'Left Group', description: 'You have left the group' });
      await fetchMyGroups();
      return true;
    } catch (error: any) {
      console.error('Error leaving group:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to leave group',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    myGroups,
    publicGroups,
    loading,
    currentUserId,
    createGroup,
    joinGroupByCode,
    leaveGroup,
    refetch: fetchMyGroups,
  };
}
