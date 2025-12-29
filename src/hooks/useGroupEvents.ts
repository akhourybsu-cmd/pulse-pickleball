import { useState, useEffect, useCallback } from 'react';
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

export function useGroupEvents(groupId: string | undefined) {
  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEvents = useCallback(async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
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
        .from('profiles')
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

      const eventsWithData: GroupEvent[] = (eventsData || []).map(e => {
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

      setEvents(eventsWithData);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast({
        title: 'Error',
        description: 'Failed to load events',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [groupId, toast]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_events_${groupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_events',
          filter: `group_id=eq.${groupId}`,
        },
        () => fetchEvents()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_event_rsvps',
        },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, fetchEvents]);

  const createEvent = async (eventData: {
    title: string;
    description?: string;
    start_time: string;
    end_time?: string;
    location_type?: 'court' | 'venue' | 'custom';
    custom_location?: string;
    capacity?: number;
    skill_level_min?: number;
    skill_level_max?: number;
  }) => {
    if (!groupId) return null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('group_events')
        .insert({
          group_id: groupId,
          created_by: user.id,
          ...eventData,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Event Created!', description: 'Your event has been scheduled' });
      await fetchEvents();
      return data;
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create event',
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('group_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({ title: 'Deleted', description: 'Event has been removed' });
      await fetchEvents();
      return true;
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete event',
        variant: 'destructive',
      });
      return false;
    }
  };

  const updateRsvp = async (eventId: string, status: 'going' | 'maybe' | 'not_going') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if RSVP exists
      const { data: existing } = await supabase
        .from('group_event_rsvps')
        .select('id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single();

      if (existing) {
        // Update
        await supabase
          .from('group_event_rsvps')
          .update({ status })
          .eq('id', existing.id);
      } else {
        // Insert
        await supabase
          .from('group_event_rsvps')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status,
          });
      }

      await fetchEvents();
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
    createEvent,
    deleteEvent,
    updateRsvp,
    refetch: fetchEvents,
  };
}
