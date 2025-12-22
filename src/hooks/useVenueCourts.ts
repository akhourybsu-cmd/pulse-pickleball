import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface VenueCourt {
  id: string;
  venue_id: string;
  name: string;
  court_number: number;
  surface_type: string;
  is_active: boolean;
  hourly_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCourtData {
  venue_id: string;
  name: string;
  court_number: number;
  surface_type?: string;
  is_active?: boolean;
  hourly_rate?: number | null;
  notes?: string | null;
}

export function useVenueCourts(venueId: string | null) {
  const [courts, setCourts] = useState<VenueCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCourts = useCallback(async () => {
    if (!venueId) {
      setCourts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_courts')
        .select('*')
        .eq('venue_id', venueId)
        .order('court_number', { ascending: true });

      if (error) throw error;
      setCourts(data || []);
    } catch (error: any) {
      console.error('Error fetching courts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load courts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [venueId, toast]);

  useEffect(() => {
    fetchCourts();
  }, [fetchCourts]);

  const createCourt = async (courtData: CreateCourtData) => {
    try {
      const { data, error } = await supabase
        .from('venue_courts')
        .insert(courtData)
        .select()
        .single();

      if (error) throw error;
      
      setCourts(prev => [...prev, data].sort((a, b) => a.court_number - b.court_number));
      toast({
        title: 'Court Created',
        description: `${courtData.name} has been added`,
      });
      return data;
    } catch (error: any) {
      console.error('Error creating court:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create court',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const updateCourt = async (courtId: string, updates: Partial<VenueCourt>) => {
    try {
      const { data, error } = await supabase
        .from('venue_courts')
        .update(updates)
        .eq('id', courtId)
        .select()
        .single();

      if (error) throw error;
      
      setCourts(prev => prev.map(c => c.id === courtId ? data : c));
      toast({
        title: 'Court Updated',
        description: 'Changes saved successfully',
      });
      return data;
    } catch (error: any) {
      console.error('Error updating court:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update court',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const deleteCourt = async (courtId: string) => {
    try {
      const { error } = await supabase
        .from('venue_courts')
        .delete()
        .eq('id', courtId);

      if (error) throw error;
      
      setCourts(prev => prev.filter(c => c.id !== courtId));
      toast({
        title: 'Court Deleted',
        description: 'Court has been removed',
      });
    } catch (error: any) {
      console.error('Error deleting court:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete court',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return {
    courts,
    loading,
    refetch: fetchCourts,
    createCourt,
    updateCourt,
    deleteCourt,
  };
}
