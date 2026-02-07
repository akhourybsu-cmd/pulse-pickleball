import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface UserVenue {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  role: 'owner' | 'manager';
}

export function useUserVenues() {
  const [venues, setVenues] = useState<UserVenue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUserVenues() {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setVenues([]);
        setLoading(false);
        return;
      }

      // Fetch venues where user is owner
      const { data: ownedVenues } = await supabase
        .from('venues')
        .select('id, name, slug, logo_url, address, city, state')
        .eq('owner_id', user.id);

      // Fetch venues where user is staff with owner/manager role
      const { data: staffVenues } = await supabase
        .from('venue_staff')
        .select(`
          role,
          venues:venue_id (
            id,
            name,
            slug,
            logo_url,
            address,
            city,
            state
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .in('role', ['owner', 'manager']);

      const venueMap = new Map<string, UserVenue>();

      // Add owned venues
      ownedVenues?.forEach(v => {
        venueMap.set(v.id, {
          ...v,
          role: 'owner',
        });
      });

      // Add staff venues (owner role takes precedence)
      staffVenues?.forEach(sv => {
        const v = sv.venues as unknown as {
          id: string;
          name: string;
          slug: string | null;
          logo_url: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
        };
        if (v && !venueMap.has(v.id)) {
          venueMap.set(v.id, {
            ...v,
            role: sv.role as 'owner' | 'manager',
          });
        }
      });

      setVenues(Array.from(venueMap.values()));
      setLoading(false);
    }

    fetchUserVenues();
  }, []);

  return { venues, loading };
}
