import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueSettings {
  id: string;
  name: string;
  slug: string | null;
  address: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  timezone: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  website_url: string | null;
  description: string | null;
  logo_url: string | null;
  is_active: boolean;
  // Branding fields
  primary_color: string | null;
  secondary_color: string | null;
  banner_url: string | null;
  cover_image_url: string | null;
  logo_shape: string | null;
  cover_focal_point: string | null;
  tagline: string | null;
  show_pulse_branding: boolean;
  social_facebook: string | null;
  social_instagram: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  tiktok_url: string | null;
  amenities: string[] | null;
  // Platform fee
  platform_fee_percent: number | null;
  // Venue type and status
  venue_type: string | null;
  visibility: string | null;
  status: string | null;
  is_searchable: boolean;
  allow_follow: boolean;
  // Welcome/CTA fields
  welcome_headline: string | null;
  welcome_message: string | null;
  cta_primary_label: string | null;
  cta_secondary_label: string | null;
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
        .select('*')
        .eq('id', venueId)
        .single();

      if (error) throw error;
      // Type assertion for new fields not yet in generated types
      setSettings(data as unknown as VenueSettings);
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
        .update(updates as any)
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
