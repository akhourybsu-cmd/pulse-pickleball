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
  is_venue_verified?: boolean;
  venue?: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: string;
  last_read_at: string;
  joined_at: string;
  display_order?: number;
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
      // Get groups where user is a member (with venue data for venue_official groups)
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select(`
          *,
          groups (
            *,
            venues:venue_id (id, name, slug, logo_url, primary_color, secondary_color)
          )
        `)
        .eq('user_id', currentUserId)
        .eq('status', 'active');

      if (memberError) throw memberError;

      const groups: GroupWithMembership[] = (memberships || [])
        .filter((m: any) => m.groups)
        .map((m: any) => ({
          ...m.groups,
          venue: m.groups.venues || null,
          membership: {
            id: m.id,
            group_id: m.group_id,
            user_id: m.user_id,
            role: m.role,
            status: m.status,
            last_read_at: m.last_read_at,
            joined_at: m.joined_at,
            display_order: m.display_order ?? 0,
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

      // Sort by custom order first, then by unread, then by activity
      groups.sort((a, b) => {
        const orderA = a.membership?.display_order ?? 999;
        const orderB = b.membership?.display_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
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
    venue_id?: string;
  }) => {
    if (!currentUserId) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: groupData.name,
          description: groupData.description,
          type: groupData.type,
          visibility: groupData.visibility,
          join_method: groupData.join_method,
          venue_id: groupData.venue_id || null,
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

    const trimmed = (code || '').trim();
    if (!trimmed) {
      toast({ title: 'Code Required', description: 'Enter an invite code', variant: 'destructive' });
      return null;
    }

    try {
      const { data, error } = await supabase.rpc('join_group_by_code' as any, { p_code: trimmed });
      if (error) throw error;

      const result = (data ?? {}) as {
        status?: string;
        group_id?: string;
        group_name?: string;
        message?: string;
      };

      switch (result.status) {
        case 'joined':
          toast({ title: 'Joined!', description: `Welcome to ${result.group_name}!` });
          await fetchMyGroups();
          return { id: result.group_id, name: result.group_name } as any;
        case 'pending':
          toast({ title: 'Request Sent', description: 'Your join request has been sent to the group admins' });
          return { id: result.group_id, name: result.group_name } as any;
        case 'already_member':
          toast({ title: 'Already a Member', description: 'You are already in this group' });
          return { id: result.group_id, name: result.group_name } as any;
        case 'banned':
          toast({ title: 'Access Denied', description: result.message || 'You have been banned from this group', variant: 'destructive' });
          return null;
        case 'not_found':
        default:
          toast({ title: 'Not Found', description: result.message || 'Invalid invite code', variant: 'destructive' });
          return null;
      }
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

  const joinPublicGroup = async (groupId: string) => {
    if (!currentUserId) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return null;
    }

    try {
      // Find the group
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (findError || !group) {
        toast({ title: 'Error', description: 'Group not found', variant: 'destructive' });
        return null;
      }

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .single();

      if (existingMember) {
        if (existingMember.status === 'active') {
          toast({ title: 'Already a Member', description: 'You are already in this group' });
          return group;
        }
        if (existingMember.status === 'pending') {
          toast({ title: 'Pending', description: 'Your join request is still pending' });
          return group;
        }
      }

      const status = group.join_method === 'request_to_join' ? 'pending' : 'active';

      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
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
        await fetchPublicGroups();
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

  const updateGroupOrder = async (orderedGroups: GroupWithMembership[]) => {
    if (!currentUserId) return;

    // Optimistic update
    setMyGroups(orderedGroups);

    try {
      // Batch update display_order for all groups
      const updates = orderedGroups.map((group, index) => ({
        id: group.membership!.id,
        display_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from('group_members')
          .update({ display_order: update.display_order })
          .eq('id', update.id);
      }
    } catch (error) {
      console.error('Error updating group order:', error);
      // Revert on error
      await fetchMyGroups();
    }
  };

  return {
    myGroups,
    publicGroups,
    loading,
    currentUserId,
    createGroup,
    joinGroupByCode,
    joinPublicGroup,
    leaveGroup,
    updateGroupOrder,
    refetch: fetchMyGroups,
  };
}
