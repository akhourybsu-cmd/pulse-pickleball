import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VenueWithActivity {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  city: string | null;
  state: string | null;
  bookingsCount: number;
  eventsCount: number;
  lastActivity: string;
}

export function usePlayerVenueActivity() {
  const [venues, setVenues] = useState<VenueWithActivity[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVenues([]);
        setUpcomingBookings([]);
        setUpcomingEvents([]);
        setLoading(false);
        return;
      }

      // Fetch bookings and event registrations in parallel
      const [bookingsRes, eventsRes] = await Promise.all([
        supabase
          .from('venue_bookings')
          .select(`
            id, venue_id, start_time, end_time, status,
            venue:venues(id, name, slug, logo_url, city, state)
          `)
          .eq('user_id', user.id)
          .order('start_time', { ascending: false }),
        supabase
          .from('venue_event_registrations')
          .select(`
            id, status, created_at,
            event:venue_events(id, title, start_time, end_time, venue_id,
              venue:venues(id, name, slug, logo_url, city, state))
          `)
          .eq('user_id', user.id)
          .in('status', ['confirmed', 'registered'])
          .order('created_at', { ascending: false })
      ]);

      // Get upcoming bookings (future dates)
      const now = new Date().toISOString();
      const upcomingBookingsList = (bookingsRes.data || []).filter(
        b => b.start_time > now && b.status !== 'cancelled'
      ).slice(0, 3);
      setUpcomingBookings(upcomingBookingsList);

      // Get upcoming events
      const upcomingEventsList = (eventsRes.data || []).filter(
        e => e.event?.start_time && e.event.start_time > now
      ).slice(0, 3);
      setUpcomingEvents(upcomingEventsList);

      // Aggregate venues with activity counts
      const venueMap = new Map<string, VenueWithActivity>();

      (bookingsRes.data || []).forEach(booking => {
        if (booking.venue && booking.status !== 'cancelled') {
          const v = booking.venue as any;
          const existing = venueMap.get(v.id);
          if (existing) {
            existing.bookingsCount++;
            if (booking.start_time > existing.lastActivity) {
              existing.lastActivity = booking.start_time;
            }
          } else {
            venueMap.set(v.id, {
              id: v.id,
              name: v.name,
              slug: v.slug,
              logo_url: v.logo_url,
              city: v.city,
              state: v.state,
              bookingsCount: 1,
              eventsCount: 0,
              lastActivity: booking.start_time
            });
          }
        }
      });

      (eventsRes.data || []).forEach(reg => {
        if (reg.event?.venue) {
          const v = reg.event.venue as any;
          const existing = venueMap.get(v.id);
          if (existing) {
            existing.eventsCount++;
            if (reg.event.start_time > existing.lastActivity) {
              existing.lastActivity = reg.event.start_time;
            }
          } else {
            venueMap.set(v.id, {
              id: v.id,
              name: v.name,
              slug: v.slug,
              logo_url: v.logo_url,
              city: v.city,
              state: v.state,
              bookingsCount: 0,
              eventsCount: 1,
              lastActivity: reg.event.start_time
            });
          }
        }
      });

      // Sort by last activity
      const sortedVenues = Array.from(venueMap.values()).sort(
        (a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      );

      setVenues(sortedVenues);
    } catch (error) {
      console.error('Error fetching player venue activity:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  return {
    venues,
    upcomingBookings,
    upcomingEvents,
    loading,
    refetch: fetchActivity
  };
}
