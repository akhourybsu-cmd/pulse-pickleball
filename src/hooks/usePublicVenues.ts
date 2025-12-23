import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicVenue {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  description: string | null;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface PublicVenueCourt {
  id: string;
  venue_id: string;
  name: string;
  court_number: number;
  surface_type: string | null;
  hourly_rate: number | null;
  is_active: boolean;
}

export interface PublicVenueEvent {
  id: string;
  venue_id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  current_participants: number;
  price: number | null;
  skill_level: string | null;
}

export interface PublicVenueCoach {
  id: string;
  venue_id: string;
  name: string;
  bio: string | null;
  specialties: string[] | null;
  hourly_rate: number | null;
  avatar_url: string | null;
}

export function usePublicVenues() {
  const [venues, setVenues] = useState<PublicVenue[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVenues = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, slug, address, city, state, description, logo_url, phone, email, website')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setVenues(data || []);
    } catch (error) {
      console.error('Error fetching venues:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVenues();
  }, [fetchVenues]);

  return { venues, loading, refetch: fetchVenues };
}

export function usePublicVenueDetails(venueId: string | null) {
  const [venue, setVenue] = useState<PublicVenue | null>(null);
  const [courts, setCourts] = useState<PublicVenueCourt[]>([]);
  const [events, setEvents] = useState<PublicVenueEvent[]>([]);
  const [coaches, setCoaches] = useState<PublicVenueCoach[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!venueId) {
      setVenue(null);
      setCourts([]);
      setEvents([]);
      setCoaches([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [venueRes, courtsRes, eventsRes, coachesRes] = await Promise.all([
        supabase
          .from('venues')
          .select('id, name, slug, address, city, state, description, logo_url, phone, email, website')
          .eq('id', venueId)
          .eq('is_active', true)
          .single(),
        supabase
          .from('venue_courts')
          .select('id, venue_id, name, court_number, surface_type, hourly_rate, is_active')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('court_number'),
        supabase
          .from('venue_events')
          .select('id, venue_id, title, description, event_type, start_time, end_time, max_participants, current_participants, price, skill_level')
          .eq('venue_id', venueId)
          .eq('is_published', true)
          .gte('start_time', new Date().toISOString())
          .order('start_time'),
        supabase
          .from('venue_coaches')
          .select('id, venue_id, name, bio, specialties, hourly_rate, avatar_url')
          .eq('venue_id', venueId)
          .eq('is_active', true)
          .order('name')
      ]);

      if (venueRes.error) throw venueRes.error;
      
      setVenue(venueRes.data);
      setCourts(courtsRes.data || []);
      setEvents(eventsRes.data || []);
      setCoaches(coachesRes.data || []);
    } catch (error) {
      console.error('Error fetching venue details:', error);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { venue, courts, events, coaches, loading, refetch: fetchDetails };
}
