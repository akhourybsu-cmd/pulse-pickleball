import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueCoach {
  id: string;
  venue_id: string;
  user_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  bio: string | null;
  specialties: string[] | null;
  hourly_rate: number | null;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCoachData {
  name: string;
  email?: string;
  phone?: string;
  bio?: string;
  specialties?: string[];
  hourly_rate?: number;
  is_active?: boolean;
}

export function useVenueCoaches(venueId: string | null) {
  const [coaches, setCoaches] = useState<VenueCoach[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCoaches = useCallback(async () => {
    if (!venueId) {
      setCoaches([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_coaches')
        .select('*')
        .eq('venue_id', venueId)
        .order('name', { ascending: true });

      if (error) throw error;
      setCoaches(data || []);
    } catch (error: any) {
      console.error('Error fetching coaches:', error);
      toast.error('Failed to load coaches');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  const createCoach = async (data: CreateCoachData) => {
    if (!venueId) return null;

    try {
      const { data: newCoach, error } = await supabase
        .from('venue_coaches')
        .insert({
          venue_id: venueId,
          ...data
        })
        .select()
        .single();

      if (error) throw error;
      setCoaches(prev => [...prev, newCoach]);
      toast.success('Coach added');
      return newCoach;
    } catch (error: any) {
      console.error('Error creating coach:', error);
      toast.error('Failed to add coach');
      return null;
    }
  };

  const updateCoach = async (id: string, updates: Partial<VenueCoach>) => {
    try {
      const { error } = await supabase
        .from('venue_coaches')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setCoaches(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      toast.success('Coach updated');
    } catch (error: any) {
      console.error('Error updating coach:', error);
      toast.error('Failed to update coach');
    }
  };

  const deleteCoach = async (id: string) => {
    try {
      const { error } = await supabase
        .from('venue_coaches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setCoaches(prev => prev.filter(c => c.id !== id));
      toast.success('Coach removed');
    } catch (error: any) {
      console.error('Error deleting coach:', error);
      toast.error('Failed to remove coach');
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await updateCoach(id, { is_active: isActive });
  };

  return {
    coaches,
    loading,
    refetch: fetchCoaches,
    createCoach,
    updateCoach,
    deleteCoach,
    toggleActive
  };
}
