import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueDisplaySettings {
  venue_id: string;
  featured_event_id: string | null;
  event_sort_mode: string;
  allow_player_posts: boolean;
  show_gallery: boolean;
  show_amenities: boolean;
  show_facility_details: boolean;
  updated_at: string;
}

export function useVenueDisplaySettings(venueId: string | null) {
  const [displaySettings, setDisplaySettings] = useState<VenueDisplaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!venueId) {
      setDisplaySettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_settings')
        .select('*')
        .eq('venue_id', venueId)
        .single();

      if (error) {
        // If no row exists, create one
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('venue_settings')
            .insert({ venue_id: venueId })
            .select()
            .single();
          
          if (insertError) throw insertError;
          setDisplaySettings(newData as unknown as VenueDisplaySettings);
        } else {
          throw error;
        }
      } else {
        setDisplaySettings(data as unknown as VenueDisplaySettings);
      }
    } catch (error: any) {
      console.error('Error fetching venue display settings:', error);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<VenueDisplaySettings>) => {
    if (!venueId) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('venue_settings')
        .update(updates as any)
        .eq('venue_id', venueId);

      if (error) throw error;
      setDisplaySettings(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Display settings saved');
      return true;
    } catch (error: any) {
      console.error('Error updating display settings:', error);
      toast.error('Failed to save display settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    displaySettings,
    loading,
    saving,
    refetch: fetchSettings,
    updateSettings
  };
}
