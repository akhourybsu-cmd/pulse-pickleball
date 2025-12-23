import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicVenue {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  banner_url: string | null;
  tagline: string | null;
  show_pulse_branding: boolean;
  social_facebook: string | null;
  social_instagram: string | null;
  hours_of_operation: Record<string, { open: string; close: string }> | null;
  amenities: string[] | null;
}

export interface VenueCourt {
  id: string;
  name: string;
  surface_type: string | null;
  is_active: boolean;
  hourly_rate: number | null;
  court_number: number | null;
}

export interface VenueEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  current_participants: number;
  price: number | null;
  event_type: string;
  skill_level: string | null;
}

export interface VenueCoach {
  id: string;
  name: string;
  bio: string | null;
  specialties: string[] | null;
  hourly_rate: number | null;
  is_active: boolean;
  avatar_url: string | null;
}

export function usePublicVenue(slug: string | undefined) {
  const [venue, setVenue] = useState<PublicVenue | null>(null);
  const [courts, setCourts] = useState<VenueCourt[]>([]);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [coaches, setCoaches] = useState<VenueCoach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError('No venue specified');
      return;
    }

    const fetchVenue = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch venue by slug - using select * to get all fields including new branding ones
        const { data: venueData, error: venueError } = await supabase
          .from('venues')
          .select('id, name, slug, address, city, state, zip_code, phone, email, website, description, logo_url, is_active, owner_id, timezone, primary_color, secondary_color, banner_url, tagline, show_pulse_branding, social_facebook, social_instagram, amenities')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();

        if (venueError) {
          console.error('Venue fetch error:', venueError);
          throw new Error('Venue not found');
        }
        
        // Type assertion since new columns aren't in generated types yet
        setVenue(venueData as unknown as PublicVenue);

        // Fetch courts
        const { data: courtsData } = await supabase
          .from('venue_courts')
          .select('id, name, surface_type, is_active, hourly_rate, court_number')
          .eq('venue_id', venueData.id)
          .eq('is_active', true)
          .order('court_number');

        setCourts((courtsData || []) as VenueCourt[]);

        // Fetch upcoming events
        const { data: eventsData } = await supabase
          .from('venue_events')
          .select('id, title, description, start_time, end_time, max_participants, current_participants, price, event_type, skill_level')
          .eq('venue_id', venueData.id)
          .eq('is_published', true)
          .gte('start_time', new Date().toISOString())
          .order('start_time')
          .limit(6);

        setEvents((eventsData || []) as VenueEvent[]);

        // Fetch coaches
        const { data: coachesData } = await supabase
          .from('venue_coaches')
          .select('id, name, bio, specialties, hourly_rate, is_active, avatar_url')
          .eq('venue_id', venueData.id)
          .eq('is_active', true)
          .order('name');

        setCoaches((coachesData || []) as VenueCoach[]);

      } catch (err: any) {
        setError(err.message || 'Failed to load venue');
      } finally {
        setLoading(false);
      }
    };

    fetchVenue();
  }, [slug]);

  return { venue, courts, events, coaches, loading, error };
}
