import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  status: 'registered' | 'waitlisted' | 'cancelled' | 'attended';
  registered_at: string;
  event?: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    venue_id: string;
    event_type: string;
    price: number | null;
    venue?: {
      name: string;
      address: string | null;
    };
  };
}

export function useEventRegistration() {
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistrations = useCallback(async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setRegistrations([]);
        return;
      }

      const { data, error } = await supabase
        .from('venue_event_registrations')
        .select(`
          id, event_id, user_id, status, registered_at,
          event:venue_events(
            id, title, start_time, end_time, venue_id, event_type, price,
            venue:venues(name, address)
          )
        `)
        .eq('user_id', user.user.id)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setRegistrations((data || []) as EventRegistration[]);
    } catch (error: any) {
      console.error('Error fetching registrations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const registerForEvent = async (eventId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Please sign in to register for events');
        return null;
      }

      // Check if already registered
      const existing = registrations.find(r => r.event_id === eventId && r.status !== 'cancelled');
      if (existing) {
        toast.error('You are already registered for this event');
        return null;
      }

      // Check event capacity
      const { data: event } = await supabase
        .from('venue_events')
        .select('max_participants, current_participants')
        .eq('id', eventId)
        .single();

      const isWaitlisted = event?.max_participants && 
        event.current_participants >= event.max_participants;

      const { data: registration, error } = await supabase
        .from('venue_event_registrations')
        .insert({
          event_id: eventId,
          user_id: user.user.id,
          status: isWaitlisted ? 'waitlisted' : 'registered'
        })
        .select(`
          id, event_id, user_id, status, registered_at,
          event:venue_events(
            id, title, start_time, end_time, venue_id, event_type, price,
            venue:venues(name, address)
          )
        `)
        .single();

      if (error) throw error;

      // Update event participant count
      if (!isWaitlisted) {
        await supabase
          .from('venue_events')
          .update({ current_participants: (event?.current_participants || 0) + 1 })
          .eq('id', eventId);
      }

      setRegistrations(prev => [registration as EventRegistration, ...prev]);
      toast.success(isWaitlisted ? 'Added to waitlist' : 'Registered successfully!');
      return registration;
    } catch (error: any) {
      console.error('Error registering for event:', error);
      toast.error('Failed to register for event');
      return null;
    }
  };

  const cancelRegistration = async (registrationId: string) => {
    try {
      const registration = registrations.find(r => r.id === registrationId);
      
      const { error } = await supabase
        .from('venue_event_registrations')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', registrationId);

      if (error) throw error;

      // Decrement participant count if was registered (not waitlisted)
      if (registration?.status === 'registered' && registration.event_id) {
        const { data: event } = await supabase
          .from('venue_events')
          .select('current_participants')
          .eq('id', registration.event_id)
          .single();
        
        if (event && event.current_participants > 0) {
          await supabase
            .from('venue_events')
            .update({ current_participants: event.current_participants - 1 })
            .eq('id', registration.event_id);
        }
      }

      setRegistrations(prev => prev.map(r => 
        r.id === registrationId ? { ...r, status: 'cancelled' as const } : r
      ));
      toast.success('Registration cancelled');
    } catch (error: any) {
      console.error('Error cancelling registration:', error);
      toast.error('Failed to cancel registration');
    }
  };

  const isRegistered = (eventId: string) => {
    return registrations.some(r => r.event_id === eventId && r.status !== 'cancelled');
  };

  const getRegistrationStatus = (eventId: string) => {
    const reg = registrations.find(r => r.event_id === eventId && r.status !== 'cancelled');
    return reg?.status || null;
  };

  return {
    registrations,
    loading,
    refetch: fetchRegistrations,
    registerForEvent,
    cancelRegistration,
    isRegistered,
    getRegistrationStatus
  };
}
