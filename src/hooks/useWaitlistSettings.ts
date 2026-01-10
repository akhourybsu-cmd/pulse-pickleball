import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WaitlistSettings {
  id: string;
  event_id: string;
  promotion_window_hours: number;
  auto_promote: boolean;
  notify_on_promotion: boolean;
  charge_on_promotion: boolean;
  created_at: string;
  updated_at: string;
}

interface WaitlistSettingsInput {
  promotion_window_hours?: number;
  auto_promote?: boolean;
  notify_on_promotion?: boolean;
  charge_on_promotion?: boolean;
}

/**
 * Hook to manage waitlist settings for an event
 */
export function useWaitlistSettings(eventId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['waitlist-settings', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data, error } = await supabase
        .from('waitlist_settings')
        .select('*')
        .eq('event_id', eventId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching waitlist settings:', error);
        return null;
      }

      return data as WaitlistSettings | null;
    },
    enabled: !!eventId,
  });

  // Upsert settings
  const updateSettings = useMutation({
    mutationFn: async (input: WaitlistSettingsInput) => {
      if (!eventId) throw new Error('No event ID');

      const { data, error } = await supabase
        .from('waitlist_settings')
        .upsert({
          event_id: eventId,
          ...input,
        }, { onConflict: 'event_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist-settings', eventId] });
      toast.success('Waitlist settings updated');
    },
    onError: (error: Error) => {
      console.error('Error updating waitlist settings:', error);
      toast.error('Failed to update waitlist settings');
    },
  });

  return {
    settings,
    isLoading,
    updateSettings: updateSettings.mutate,
    isUpdating: updateSettings.isPending,
  };
}

/**
 * Hook to get waitlisted registrations for an event
 */
export function useEventWaitlist(eventId: string | undefined) {
  return useQuery({
    queryKey: ['event-waitlist', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await supabase
        .from('event_registrations')
        .select(`
          *,
          profiles:user_id (
            id,
            display_name,
            avatar_url,
            current_rating
          )
        `)
        .eq('event_id', eventId)
        .eq('status', 'waitlisted')
        .eq('auto_expired', false)
        .order('waitlist_position', { ascending: true })
        .order('registered_at', { ascending: true });

      if (error) {
        console.error('Error fetching waitlist:', error);
        return [];
      }

      return data;
    },
    enabled: !!eventId,
  });
}

/**
 * Hook for manual waitlist management
 */
export function useWaitlistManagement(eventId: string | undefined) {
  const queryClient = useQueryClient();

  // Manual promotion
  const promoteNext = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');

      const { data, error } = await supabase.rpc('promote_from_waitlist', {
        p_event_id: eventId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (promotedId) => {
      queryClient.invalidateQueries({ queryKey: ['event-waitlist', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-registrations', eventId] });
      
      if (promotedId) {
        toast.success('Player promoted from waitlist');
      } else {
        toast.info('No players on waitlist to promote');
      }
    },
    onError: (error: Error) => {
      console.error('Error promoting from waitlist:', error);
      toast.error('Failed to promote from waitlist');
    },
  });

  // Remove from waitlist
  const removeFromWaitlist = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('event_registrations')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', registrationId);

      if (error) throw error;

      // Reorder remaining waitlist positions
      if (eventId) {
        await supabase.rpc('promote_from_waitlist', { p_event_id: eventId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-waitlist', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-registrations', eventId] });
      toast.success('Removed from waitlist');
    },
    onError: (error: Error) => {
      console.error('Error removing from waitlist:', error);
      toast.error('Failed to remove from waitlist');
    },
  });

  // Promote specific player (skip queue)
  const promotePlayer = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('event_registrations')
        .update({ 
          status: 'confirmed',
          promoted_at: new Date().toISOString(),
          waitlist_position: null,
        })
        .eq('id', registrationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-waitlist', eventId] });
      queryClient.invalidateQueries({ queryKey: ['event-registrations', eventId] });
      toast.success('Player promoted');
    },
    onError: (error: Error) => {
      console.error('Error promoting player:', error);
      toast.error('Failed to promote player');
    },
  });

  return {
    promoteNext: promoteNext.mutate,
    removeFromWaitlist: removeFromWaitlist.mutate,
    promotePlayer: promotePlayer.mutate,
    isPromoting: promoteNext.isPending || promotePlayer.isPending,
    isRemoving: removeFromWaitlist.isPending,
  };
}
