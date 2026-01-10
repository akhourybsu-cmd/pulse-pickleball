import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueFacilityDetails {
  venue_id: string;
  court_count: number;
  location_type: 'indoor' | 'outdoor' | 'mixed';
  surface_type: 'hard' | 'wood' | 'sport_court' | 'clay' | 'other';
  has_lighting: boolean;
  climate_controlled: boolean;
  amenity_restrooms: boolean;
  amenity_water: boolean;
  amenity_parking: boolean;
  amenity_seating: boolean;
  amenity_pro_shop: boolean;
  amenity_food_nearby: boolean;
  offers_open_play: boolean;
  open_play_notes: string | null;
  beginner_friendly: boolean;
  programs_notes: string | null;
  updated_at: string;
}

export function useVenueFacility(venueId: string | null) {
  const [facility, setFacility] = useState<VenueFacilityDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFacility = useCallback(async () => {
    if (!venueId) {
      setFacility(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_facility_details')
        .select('*')
        .eq('venue_id', venueId)
        .single();

      if (error) {
        // If no row exists, create one
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('venue_facility_details')
            .insert({ venue_id: venueId })
            .select()
            .single();
          
          if (insertError) throw insertError;
          setFacility(newData as unknown as VenueFacilityDetails);
        } else {
          throw error;
        }
      } else {
        setFacility(data as unknown as VenueFacilityDetails);
      }
    } catch (error: any) {
      console.error('Error fetching facility details:', error);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchFacility();
  }, [fetchFacility]);

  const updateFacility = async (updates: Partial<VenueFacilityDetails>) => {
    if (!venueId) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('venue_facility_details')
        .update(updates as any)
        .eq('venue_id', venueId);

      if (error) throw error;
      setFacility(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Facility details saved');
      return true;
    } catch (error: any) {
      console.error('Error updating facility details:', error);
      toast.error('Failed to save facility details');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    facility,
    loading,
    saving,
    refetch: fetchFacility,
    updateFacility
  };
}
