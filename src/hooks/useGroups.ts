import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  type: 'crew' | 'league' | 'open_play' | 'venue_official' | 'tournament' | 'club';
  visibility: 'public' | 'unlisted' | 'private';
  join_method: 'open' | 'request_to_join' | 'invite_only';
  invite_code: string | null;
  /** When set, the invite_code is rejected after this timestamp. NULL = never expires. */
  invite_code_expires_at: string | null;
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
    cover_image_url: string | null;
    logo_image_fit: 'cover' | 'contain' | null;
    cover_image_fit: 'cover' | 'contain' | null;
    logo_shape: 'circle' | 'square' | null;
    cover_focal_point: 'top' | 'center' | null;
    primary_color: string | null;
    secondary_color: string | null;
    tagline: string | null;
    welcome_headline: string | null;
    welcome_message: string | null;
    city?: string | null;
    state?: string | null;
    phone?: string | null;
    email?: string | null;
    website_url?: string | null;
    hours_of_operation?: unknown;
  } | null;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: 'owner' | 'moderator' | 'member';
  status: string;
  last_read_at: string | null;
  last_chat_read_at?: string | null;
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
  const queryClient = useQueryClient();

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
            venues:venue_id (id, name, slug, logo_url, cover_image_url, logo_image_fit, cover_image_fit, logo_shape, cover_focal_point, primary_color, secondary_color, tagline, welcome_headline, welcome_message)
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
            last_chat_read_at: m.last_chat_read_at ?? m.last_read_at,
            joined_at: m.joined_at,
            display_order: m.display_order ?? 0,
          },
        }));

      // Calculate unread counts in parallel — the sequential loop was an
      // N+1 that added one round-trip of latency per joined group.
      await Promise.all(
        groups.map(async (group) => {
          if (!group.membership?.last_read_at) return;
          const { count } = await supabase
            .from('group_posts')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id)
            .gt('created_at', group.membership.last_read_at);

          group.unread_count = count || 0;
        })
      );

      // Any group with unread activity floats to the very top — a group
      // "with a notification" should always be the first thing you see.
      // Below that, honor any custom display_order, then most-recent
      // activity as the final tiebreaker.
      groups.sort((a, b) => {
        const aUnread = (a.unread_count || 0) > 0;
        const bUnread = (b.unread_count || 0) > 0;
        if (aUnread !== bUnread) return aUnread ? -1 : 1;
        const orderA = a.membership?.display_order ?? 999;
        const orderB = b.membership?.display_order ?? 999;
        if (orderA !== orderB) return orderA - orderB;
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

  /**
   * Create a venue and its official community in one step.
   *
   * This is three rows across three tables (venues, venue_staff, groups), so it
   * goes through a SECURITY DEFINER function rather than three client writes —
   * a failure partway through the client version would leave an orphaned venue
   * that nobody can see or delete. The venue starts unverified; the verified
   * badge is an admin decision, not a side effect of signing up.
   */
  const createVenueCommunity = async (data: {
    name: string;
    description?: string;
    visibility: Group['visibility'];
    join_method: Group['join_method'];
    venue_type?: string;
    city?: string;
    state?: string;
  }) => {
    if (!currentUserId) {
      toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
      return null;
    }

    try {
      const { data: result, error } = await supabase.rpc('create_venue_community' as any, {
        p_name: data.name,
        p_description: data.description ?? null,
        p_visibility: data.visibility,
        p_join_method: data.join_method,
        p_venue_type: data.venue_type ?? 'other',
        p_city: data.city ?? null,
        p_state: data.state ?? null,
      });

      if (error) throw error;

      const groupId = (result as { group_id?: string } | null)?.group_id;
      if (!groupId) throw new Error('Venue community was not created');

      toast({ title: 'Venue created', description: `${data.name} is ready to customize.` });
      await fetchMyGroups();

      // Return the created group so callers can navigate straight into it.
      const { data: group } = await supabase
        .from('groups')
        .select('*, venues:venue_id (id, name, slug, logo_url, cover_image_url, logo_image_fit, cover_image_fit, logo_shape, cover_focal_point, primary_color, secondary_color, tagline, welcome_headline, welcome_message)')
        .eq('id', groupId)
        .single();

      return group
        ? ({ ...(group as any), venue: (group as any).venues || null } as Group)
        : null;
    } catch (error: any) {
      console.error('Error creating venue community:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create venue community',
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
          void fetchMyGroups();
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
        case 'expired':
          toast({ title: 'Code Expired', description: result.message || 'This invite code has expired', variant: 'destructive' });
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

    // Optimistic: drop the group from the list immediately so the tap feels
    // instant, then delete + reconcile. Restore on failure.
    const prevGroups = myGroups;
    setMyGroups((gs) => gs.filter((g) => g.id !== groupId));

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', currentUserId);

      if (error) throw error;

      // Cross-cache invalidation — other React Query slices keyed by
      // this groupId would otherwise show stale members/posts/events
      // if the user still has those tabs mounted (multi-tab is the
      // main offender, but a back-nav after leaving from GroupDetail
      // hits the same staleness).
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-chat', groupId] });

      toast({ title: 'Left Group', description: 'You have left the group' });
      void fetchMyGroups();
      return true;
    } catch (error: any) {
      setMyGroups(prevGroups);
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

      // maybeSingle() — `single()` errors on zero rows and crashes the
      // try block; non-members aren't an error.
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', currentUserId)
        .maybeSingle();

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

      // Race-safe insert: two rapid join clicks (or two browser tabs)
      // can both pass the "not a member" check above and race to insert.
      // The DB has a unique (group_id, user_id) constraint, so the
      // second insert fails with 23505 — translate that into the same
      // "already a member" UX as the pre-check, rather than a generic
      // error toast.
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: currentUserId,
          role: 'member',
          status,
        });

      if (joinError) {
        if (joinError.code === '23505') {
          toast({ title: 'Already a Member', description: 'You are already in this group' });
          return group;
        }
        throw joinError;
      }

      if (status === 'pending') {
        toast({ title: 'Request Sent', description: 'Your join request has been sent to the group admins' });
      } else {
        toast({ title: 'Joined!', description: `Welcome to ${group.name}!` });
        void fetchMyGroups();
        void fetchPublicGroups();
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

      // Each row targets a distinct membership id, so the updates are
      // independent — run them in parallel instead of serially.
      const results = await Promise.all(
        updates.map((update) =>
          supabase
            .from('group_members')
            .update({ display_order: update.display_order })
            .eq('id', update.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
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
    createVenueCommunity,
    joinGroupByCode,
    joinPublicGroup,
    leaveGroup,
    updateGroupOrder,
    refetch: fetchMyGroups,
  };
}
