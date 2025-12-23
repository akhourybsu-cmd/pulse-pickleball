import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VenueBooking {
  id: string;
  venue_id: string;
  court_id: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  notes: string | null;
  total_price: number | null;
  created_at: string;
  updated_at: string;
  court?: {
    name: string;
    court_number: number;
  };
}

export interface CreateBookingData {
  court_id: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  start_time: string;
  end_time: string;
  notes?: string;
  total_price?: number;
}

export function useVenueBookings(venueId: string | null) {
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    if (!venueId) {
      setBookings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('venue_bookings')
        .select(`
          *,
          court:venue_courts(name, court_number)
        `)
        .eq('venue_id', venueId)
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBookings((data || []) as VenueBooking[]);
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (data: CreateBookingData) => {
    if (!venueId) return null;

    try {
      const { data: newBooking, error } = await supabase
        .from('venue_bookings')
        .insert({
          venue_id: venueId,
          ...data
        })
        .select(`
          *,
          court:venue_courts(name, court_number)
        `)
        .single();

      if (error) throw error;
      setBookings(prev => [...prev, newBooking as VenueBooking]);
      toast.success('Booking created');
      return newBooking;
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to create booking');
      return null;
    }
  };

  const updateBooking = async (id: string, updates: Partial<VenueBooking>) => {
    try {
      const { error } = await supabase
        .from('venue_bookings')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
      toast.success('Booking updated');
    } catch (error: any) {
      console.error('Error updating booking:', error);
      toast.error('Failed to update booking');
    }
  };

  const cancelBooking = async (id: string) => {
    await updateBooking(id, { status: 'cancelled' });
  };

  return {
    bookings,
    loading,
    refetch: fetchBookings,
    createBooking,
    updateBooking,
    cancelBooking
  };
}
