import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueSettings {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  timezone: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
}

export function useVenueSettings(venueId: string | null) {
  const [settings, setSettings] = useState<VenueSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!venueId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venues')
        .select('id, name, slug, address, city, state, zip_code, timezone, phone, email, website, description, logo_url, is_active')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      setSettings(data as VenueSettings);
    } catch (error: any) {
      console.error('Error fetching venue settings:', error);
      toast.error('Failed to load venue settings');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = async (updates: Partial<VenueSettings>) => {
    if (!venueId) return false;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('venues')
        .update(updates)
        .eq('id', venueId);

      if (error) throw error;
      setSettings(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Settings saved');
      return true;
    } catch (error: any) {
      console.error('Error updating venue settings:', error);
      toast.error('Failed to save settings');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    settings,
    loading,
    saving,
    refetch: fetchSettings,
    updateSettings
  };
}
