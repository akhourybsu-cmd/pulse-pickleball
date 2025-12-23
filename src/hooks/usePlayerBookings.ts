import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PlayerBooking {
  id: string;
  venue_id: string;
  court_id: string;
  customer_name: string;
  customer_email: string | null;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  total_price: number | null;
  created_at: string;
  court?: {
    name: string;
    court_number: number;
  };
  venue?: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
  };
}

export interface CreatePlayerBookingData {
  venue_id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  notes?: string;
}

export function usePlayerBookings() {
  const [bookings, setBookings] = useState<PlayerBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        setBookings([]);
        return;
      }

      const { data, error } = await supabase
        .from('venue_bookings')
        .select(`
          id, venue_id, court_id, customer_name, customer_email, 
          start_time, end_time, status, total_price, created_at,
          court:venue_courts(name, court_number),
          venue:venues(name, address, city, state)
        `)
        .eq('user_id', user.user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setBookings((data || []) as PlayerBooking[]);
    } catch (error: any) {
      console.error('Error fetching player bookings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const createBooking = async (data: CreatePlayerBookingData) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        toast.error('Please sign in to book a court');
        return null;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.user.id)
        .single();

      // Get court hourly rate for price calculation
      const { data: court } = await supabase
        .from('venue_courts')
        .select('hourly_rate')
        .eq('id', data.court_id)
        .single();

      const startTime = new Date(data.start_time);
      const endTime = new Date(data.end_time);
      const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const totalPrice = court?.hourly_rate ? court.hourly_rate * hours : null;

      const { data: newBooking, error } = await supabase
        .from('venue_bookings')
        .insert({
          ...data,
          user_id: user.user.id,
          customer_name: profile?.full_name || 'Player',
          customer_email: profile?.email || user.user.email,
          total_price: totalPrice,
          status: 'pending'
        })
        .select(`
          id, venue_id, court_id, customer_name, customer_email, 
          start_time, end_time, status, total_price, created_at,
          court:venue_courts(name, court_number),
          venue:venues(name, address, city, state)
        `)
        .single();

      if (error) throw error;
      setBookings(prev => [newBooking as PlayerBooking, ...prev]);
      toast.success('Court booked successfully!');
      return newBooking;
    } catch (error: any) {
      console.error('Error creating booking:', error);
      toast.error('Failed to book court');
      return null;
    }
  };

  const cancelBooking = async (id: string) => {
    try {
      const { error } = await supabase
        .from('venue_bookings')
        .update({ status: 'cancelled' })
        .eq('id', id);

      if (error) throw error;
      setBookings(prev => prev.map(b => 
        b.id === id ? { ...b, status: 'cancelled' as const } : b
      ));
      toast.success('Booking cancelled');
    } catch (error: any) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  return {
    bookings,
    loading,
    refetch: fetchBookings,
    createBooking,
    cancelBooking
  };
}
