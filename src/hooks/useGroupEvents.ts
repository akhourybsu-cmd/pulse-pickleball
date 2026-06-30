import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface GroupEvent {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location_type: 'court' | 'venue' | 'custom' | null;
  court_id: string | null;
  venue_id: string | null;
  custom_location: string | null;
  capacity: number | null;
  skill_level_min: number | null;
  skill_level_max: number | null;
  is_recurring: boolean;
  recurring_rule: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  creator_profile?: {
    display_name: string | null;
    full_name: string;
    avatar_url: string | null;
  };
  rsvps?: {
    going: number;
    maybe: number;
    not_going: number;
    waitlist: number;
  };
  user_rsvp?: 'going' | 'maybe' | 'not_going' | 'waitlist' | null;
}

async function fetchGroupEvents(groupId: string): Promise<GroupEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  
  // Fetch events
  const { data: eventsData, error } = await supabase
    .from('group_events')
    .select('*')
    .eq('group_id', groupId)
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) throw error;

  // Fetch creator profiles
  const creatorIds = [...new Set((eventsData || []).map(e => e.created_by))];
  const { data: profilesData } = await supabase
    .from('profiles_public')
    .select('id, display_name, full_name, avatar_url')
    .in('id', creatorIds);

  const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

  // Fetch RSVPs
  const eventIds = (eventsData || []).map(e => e.id);
  const { data: rsvpsData } = await supabase
    .from('group_event_rsvps')
    .select('event_id, user_id, status')
    .in('event_id', eventIds);

  // Group RSVPs by event
  const rsvpsMap = new Map<string, { going: number; maybe: number; not_going: number; waitlist: number; user_rsvp: string | null }>();
  (eventsData || []).forEach(e => {
    rsvpsMap.set(e.id, { going: 0, maybe: 0, not_going: 0, waitlist: 0, user_rsvp: null });
  });

  (rsvpsData || []).forEach(r => {
    const entry = rsvpsMap.get(r.event_id);
    if (entry) {
      if (r.status === 'going') entry.going++;
      else if (r.status === 'maybe') entry.maybe++;
      else if (r.status === 'not_going') entry.not_going++;
      else if (r.status === 'waitlist') entry.waitlist++;
      if (user && r.user_id === user.id) entry.user_rsvp = r.status;
    }
  });

  return (eventsData || []).map(e => {
    const rsvpEntry = rsvpsMap.get(e.id);
    return {
      ...e,
      location_type: e.location_type as GroupEvent['location_type'],
      creator_profile: profilesMap.get(e.created_by),
      rsvps: rsvpEntry ? {
        going: rsvpEntry.going,
        maybe: rsvpEntry.maybe,
        not_going: rsvpEntry.not_going,
        waitlist: rsvpEntry.waitlist,
      } : undefined,
      user_rsvp: rsvpEntry?.user_rsvp as any,
    };
  });
}

export function useGroupEvents(groupId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: events = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['group-events', groupId],
    queryFn: () => fetchGroupEvents(groupId!),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!groupId,
  });

  // Accepts either a single event payload (the common path — single-shot
  // event creation) or a 'series' shape that produces N rows in one
  // batch insert. Recurring series are stored as N flat rows in
  // group_events, each tagged with is_recurring=true + the same
  // recurring_rule string (e.g. "WEEKLY:8"); the rows share their
  // recurring_rule and a synthetic series_key derived from
  // first start_time + rule. Per-row RSVP / delete stays per-row.
  const createEventMutation = useMutation({
    mutationFn: async (eventData: {
      title: string;
      description?: string;
      start_time: string;
      end_time?: string;
      location_type?: 'court' | 'venue' | 'custom';
      custom_location?: string;
      capacity?: number;
      skill_level_min?: number;
      skill_level_max?: number;
      /** ISO start timestamps for additional occurrences (excluding start_time itself). */
      additional_starts?: string[];
      /** Recurrence rule string, e.g. "WEEKLY:8". Applied to every inserted row. */
      recurring_rule?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { additional_starts, recurring_rule, ...base } = eventData;
      const isSeries = !!recurring_rule && Array.isArray(additional_starts) && additional_starts.length > 0;

      // For a single event, end_time is the user-set ISO. For a series,
      // we slide end_time alongside start_time by the same delta so each
      // occurrence keeps its duration.
      const endDelta =
        base.end_time && base.start_time
          ? new Date(base.end_time).getTime() - new Date(base.start_time).getTime()
          : null;

      const baseRow = {
        group_id: groupId,
        created_by: user.id,
        ...base,
        ...(isSeries
          ? { is_recurring: true, recurring_rule }
          : { is_recurring: false }),
      };

      const rows = isSeries
        ? [
            baseRow,
            ...additional_starts!.map((iso) => ({
              ...baseRow,
              start_time: iso,
              end_time: endDelta != null
                ? new Date(new Date(iso).getTime() + endDelta).toISOString()
                : undefined,
            })),
          ]
        : [baseRow];

      const { data, error } = await supabase
        .from('group_events')
        .insert(rows)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const count = Array.isArray(data) ? data.length : 1;
      toast({
        title: 'Event Created!',
        description: count > 1
          ? `${count} occurrences scheduled`
          : 'Your event has been scheduled',
      });
      queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
    },
    onError: (error: any) => {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event',
        variant: 'destructive',
      });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from('group_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Deleted', description: 'Event has been removed' });
      queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
    },
    onError: (error: any) => {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event',
        variant: 'destructive',
      });
    },
  });

  const updateRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // maybeSingle — single() errors when no row exists (the
      // first-RSVP case for every user), which fell into the catch
      // and surfaced "Failed to update RSVP" even though the user's
      // first RSVP would have succeeded via the insert branch below.
      const { data: existing } = await supabase
        .from('group_event_rsvps')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('group_event_rsvps')
          .update({ status })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('group_event_rsvps')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status,
          });
      }

      queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
    } catch (error: any) {
      console.error('Error updating RSVP:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update RSVP',
        variant: 'destructive',
      });
    }
  };

  return {
    events,
    loading,
    createEvent: createEventMutation.mutateAsync,
    deleteEvent: deleteEventMutation.mutateAsync,
    updateRsvp,
    refetch,
  };
}

// Export for prefetching
export { fetchGroupEvents };
