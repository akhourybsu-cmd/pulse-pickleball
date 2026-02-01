import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface VenueCommunityGroup {
  id: string;
  name: string;
  member_count: number | null;
  is_venue_verified: boolean | null;
}

export function useVenueCommunityGroup(venueId: string | undefined) {
  const [group, setGroup] = useState<VenueCommunityGroup | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!venueId) {
      setGroup(null);
      return;
    }

    const fetchGroup = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('groups')
          .select('id, name, member_count, is_venue_verified')
          .eq('venue_id', venueId)
          .eq('type', 'venue_official')
          .eq('visibility', 'public')
          .maybeSingle();

        if (error) {
          console.error('Error fetching venue community group:', error);
          setGroup(null);
        } else {
          setGroup(data);
        }
      } catch (error) {
        console.error('Error fetching venue community group:', error);
        setGroup(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [venueId]);

  return { group, loading };
}
