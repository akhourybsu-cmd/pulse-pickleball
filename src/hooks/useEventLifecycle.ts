import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type EventLifecycleStatus = 
  | 'draft'
  | 'published'
  | 'registration_open'
  | 'registration_closed'
  | 'full'
  | 'checkin_open'
  | 'in_progress'
  | 'completed'
  | 'settled'
  | 'archived'
  | 'cancelled';

// Valid transitions for each status
const VALID_TRANSITIONS: Record<EventLifecycleStatus, EventLifecycleStatus[]> = {
  'draft': ['published', 'cancelled'],
  'published': ['registration_open', 'in_progress', 'cancelled'],
  'registration_open': ['registration_closed', 'full', 'in_progress', 'cancelled'],
  'registration_closed': ['checkin_open', 'in_progress', 'cancelled'],
  'full': ['registration_open', 'checkin_open', 'in_progress', 'cancelled'], // Can reopen if spots open
  'checkin_open': ['in_progress', 'cancelled'],
  'in_progress': ['completed', 'cancelled'],
  'completed': ['settled'],
  'settled': ['archived'],
  'archived': [],
  'cancelled': ['archived'],
};

// Status labels for display
export const STATUS_LABELS: Record<EventLifecycleStatus, string> = {
  'draft': 'Draft',
  'published': 'Published',
  'registration_open': 'Registration Open',
  'registration_closed': 'Registration Closed',
  'full': 'Full (Waitlist)',
  'checkin_open': 'Check-in Open',
  'in_progress': 'In Progress',
  'completed': 'Completed',
  'settled': 'Settled',
  'archived': 'Archived',
  'cancelled': 'Cancelled',
};

/**
 * Check if a transition is valid
 */
export function isValidTransition(from: EventLifecycleStatus, to: EventLifecycleStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get available transitions from current status
 */
export function getAvailableTransitions(currentStatus: EventLifecycleStatus): EventLifecycleStatus[] {
  return VALID_TRANSITIONS[currentStatus] || [];
}

/**
 * Hook to manage event lifecycle transitions
 */
export function useEventLifecycle(eventId: string | undefined, eventTable: 'unified_events' | 'venue_events' = 'unified_events') {
  const queryClient = useQueryClient();

  const transitionMutation = useMutation({
    mutationFn: async ({ 
      newStatus, 
      currentStatus,
      reason 
    }: { 
      newStatus: EventLifecycleStatus; 
      currentStatus: EventLifecycleStatus;
      reason?: string;
    }) => {
      if (!eventId) throw new Error('No event ID');
      
      // Validate transition
      if (!isValidTransition(currentStatus, newStatus)) {
        throw new Error(`Invalid transition from ${currentStatus} to ${newStatus}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      // Update the event status
      const { data, error } = await supabase
        .from(eventTable)
        .update({ 
          status: newStatus,
          // Set is_published based on status
          is_published: !['draft', 'cancelled', 'archived'].includes(newStatus),
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;

      // Log the transition if admin audit log exists
      try {
        await supabase.from('admin_audit_log').insert({
          admin_user_id: user.id,
          action: 'event_status_change',
          resource_type: eventTable,
          resource_id: eventId,
          details: {
            from_status: currentStatus,
            to_status: newStatus,
            reason,
          },
        });
      } catch (e) {
        // Non-critical, just log
        console.warn('Failed to log status change:', e);
      }

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['venue-events'] });
      queryClient.invalidateQueries({ queryKey: ['unified-events'] });
      toast.success(`Event status changed to ${STATUS_LABELS[variables.newStatus]}`);
    },
    onError: (error: Error) => {
      console.error('Error transitioning event:', error);
      toast.error(error.message || 'Failed to update event status');
    },
  });

  // Quick action mutations
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');
      
      const { data, error } = await supabase
        .from(eventTable)
        .update({ 
          status: 'published',
          is_published: true,
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['venue-events'] });
      toast.success('Event published');
    },
    onError: (error: Error) => {
      toast.error('Failed to publish event');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (reason?: string) => {
      if (!eventId) throw new Error('No event ID');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Must be logged in');

      const { data, error } = await supabase
        .from(eventTable)
        .update({ 
          status: 'cancelled',
          is_published: false,
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;

      // TODO: Notify registered users
      // TODO: Process refunds if applicable

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['venue-events'] });
      toast.success('Event cancelled');
    },
    onError: (error: Error) => {
      toast.error('Failed to cancel event');
    },
  });

  const openCheckInMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');
      
      const { data, error } = await supabase
        .from(eventTable)
        .update({ status: 'checkin_open' })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Check-in is now open');
    },
    onError: (error: Error) => {
      toast.error('Failed to open check-in');
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!eventId) throw new Error('No event ID');
      
      const { data, error } = await supabase
        .from(eventTable)
        .update({ status: 'completed' })
        .eq('id', eventId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      toast.success('Event marked as completed');
    },
    onError: (error: Error) => {
      toast.error('Failed to complete event');
    },
  });

  return {
    transition: transitionMutation.mutate,
    publish: publishMutation.mutate,
    cancel: cancelMutation.mutate,
    openCheckIn: openCheckInMutation.mutate,
    complete: completeMutation.mutate,
    isTransitioning: transitionMutation.isPending,
    isValidTransition,
    getAvailableTransitions,
    STATUS_LABELS,
  };
}
