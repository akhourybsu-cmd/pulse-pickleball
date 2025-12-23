import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueEvent {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  event_type: 'tournament' | 'clinic' | 'social' | 'league' | 'other';
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
      const { data: newEvent, error } = await supabase
        .from('venue_events')
        .insert({
          venue_id: venueId,
          created_by: user.user?.id,
          ...data
        })
        .select()
        .single();

      if (error) throw error;
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
