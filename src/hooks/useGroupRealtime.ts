import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Consolidated realtime subscription for a group.
 * Listens to all group-related tables and invalidates React Query caches.
 * Call this once at the group detail level to avoid duplicate subscriptions.
 */
export function useGroupRealtime(groupId: string | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_realtime_${groupId}`)
      // Posts changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_posts',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      })
      // Post reactions
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_post_reactions',
      }, () => {
        // Invalidate posts to refresh reaction counts
        queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      })
      // Post comments
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_post_comments',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      })
      // Events changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_events',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
      })
      // Event RSVPs
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_event_rsvps',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
      })
      // Messages changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      })
      // Members changes
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_members',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
