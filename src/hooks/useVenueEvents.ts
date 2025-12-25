import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';

export interface VenueEvent {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  event_type: 'tournament' | 'clinic' | 'social' | 'league' | 'round_robin' | 'other';
  start_time: string;
  end_time: string;
  max_participants: number | null;
  current_participants: number;
  price: number | null;
  skill_level: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  round_robin_event_id: string | null;
}

export interface CreateEventData {
  title: string;
  description?: string;
  event_type: VenueEvent['event_type'];
  start_time: string;
  end_time: string;
  max_participants?: number;
  price?: number;
  skill_level?: string;
  is_published?: boolean;
  num_courts?: number; // For round robin events
}

export function useVenueEvents(venueId: string | null) {
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    if (!venueId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_events')
        .select('*')
        .eq('venue_id', venueId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setEvents((data || []) as VenueEvent[]);
    } catch (error: any) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const createEvent = async (data: CreateEventData) => {
    if (!venueId) return null;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Get venue info for round robin creation
      const { data: venue } = await supabase
        .from('venues')
        .select('name')
        .eq('id', venueId)
        .single();

      // Create venue_event first
      const { data: newEvent, error } = await supabase
        .from('venue_events')
        .insert({
          venue_id: venueId,
          created_by: user.user.id,
          title: data.title,
          description: data.description,
          event_type: data.event_type,
          start_time: data.start_time,
          end_time: data.end_time,
          max_participants: data.max_participants,
          price: data.price,
          skill_level: data.skill_level,
          is_published: data.is_published
        })
        .select()
        .single();

      if (error) throw error;

      // If event_type is 'round_robin', create the round_robin_events entry
      if (data.event_type === 'round_robin') {
        const eventDate = parseISO(data.start_time);
        const startTime = format(eventDate, 'HH:mm:ss');
        const numCourts = data.num_courts || 4;
        
        const { data: rrEvent, error: rrError } = await supabase
          .from('round_robin_events')
          .insert({
            venue_id: venueId,
            name: data.title,
            date: format(eventDate, 'yyyy-MM-dd'),
            start_time: startTime,
            organizer_id: user.user.id,
            num_courts: numCourts,
            num_rounds: numCourts * 2, // Default rounds calculation
            location: venue?.name || 'Venue',
            status: 'draft',
            is_published: data.is_published || false,
            games_per_player: 4,
            points_to: 11,
            win_by_2: true
          })
          .select()
          .single();

        if (rrError) {
          console.error('Error creating round robin:', rrError);
          // Still continue - venue event was created
        } else if (rrEvent) {
          // Link them
          await supabase
            .from('venue_events')
            .update({ round_robin_event_id: rrEvent.id })
            .eq('id', newEvent.id);

          // Update local state with the link
          const linkedEvent = { ...newEvent, round_robin_event_id: rrEvent.id } as VenueEvent;
          setEvents(prev => [...prev, linkedEvent]);
          toast.success('Round robin event created');
          return linkedEvent;
        }
      }

      setEvents(prev => [...prev, newEvent as VenueEvent]);
      toast.success('Event created');
      return newEvent;
    } catch (error: any) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event');
      return null;
    }
  };

  const updateEvent = async (id: string, updates: Partial<VenueEvent>) => {
    try {
      const { error } = await supabase
        .from('venue_events')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setEvents(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
      toast.success('Event updated');
    } catch (error: any) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('venue_events')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== id));
      toast.success('Event deleted');
    } catch (error: any) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const togglePublish = async (id: string, isPublished: boolean) => {
    await updateEvent(id, { is_published: isPublished });
  };

  return {
    events,
    loading,
    refetch: fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    togglePublish
  };
}
