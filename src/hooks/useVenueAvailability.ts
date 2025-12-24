import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { VenueCourt } from '@/hooks/usePublicVenue';
import { format, addDays, startOfDay, endOfDay, parseISO, isSameDay } from 'date-fns';

export interface TimeSlot {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  isAvailable: boolean;
  bookingId?: string;
}

export interface CourtAvailability {
  court: VenueCourt;
  slots: TimeSlot[];
}

export interface DayAvailability {
  date: Date;
  courts: CourtAvailability[];
}

interface UseVenueAvailabilityOptions {
  venueId: string;
  courts: VenueCourt[];
  hoursOfOperation?: Record<string, { open: string; close: string }> | null;
}

// Default operating hours if not specified
const DEFAULT_HOURS = { open: '06:00', close: '22:00' };

// Generate time slots for a given day
function generateTimeSlots(
  openTime: string, 
  closeTime: string, 
  slotDurationMinutes: number = 30
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const [openHour, openMin] = openTime.split(':').map(Number);
  const [closeHour, closeMin] = closeTime.split(':').map(Number);
  
  let currentHour = openHour;
  let currentMin = openMin;
  
  while (currentHour < closeHour || (currentHour === closeHour && currentMin < closeMin)) {
    const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    // Add slot duration
    currentMin += slotDurationMinutes;
    if (currentMin >= 60) {
      currentHour += Math.floor(currentMin / 60);
      currentMin = currentMin % 60;
    }
    
    // Don't go past closing time
    if (currentHour > closeHour || (currentHour === closeHour && currentMin > closeMin)) {
      break;
    }
    
    const endTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}`;
    
    slots.push({
      startTime,
      endTime,
      isAvailable: true,
    });
  }
  
  return slots;
}

export function useVenueAvailability({ venueId, courts, hoursOfOperation }: UseVenueAvailabilityOptions) {
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<DayAvailability[]>([]);

  const fetchAvailability = useCallback(async (startDate: Date, numDays: number = 7) => {
    if (!venueId || courts.length === 0) return;
    
    setLoading(true);
    
    try {
      const endDate = addDays(startDate, numDays);
      
      // Fetch all bookings for this venue in the date range
      const { data: bookings, error } = await supabase
        .from('venue_bookings')
        .select('id, court_id, start_time, end_time, status')
        .eq('venue_id', venueId)
        .gte('start_time', startOfDay(startDate).toISOString())
        .lte('start_time', endOfDay(endDate).toISOString())
        .neq('status', 'cancelled');
      
      if (error) {
        console.error('Error fetching bookings:', error);
        return;
      }
      
      // Generate availability for each day
      const days: DayAvailability[] = [];
      
      for (let i = 0; i < numDays; i++) {
        const date = addDays(startDate, i);
        const dayName = format(date, 'EEEE').toLowerCase();
        
        // Get operating hours for this day
        const hours = hoursOfOperation?.[dayName] || DEFAULT_HOURS;
        
        // Generate availability for each court
        const courtAvailabilities: CourtAvailability[] = courts.map(court => {
          // Generate all possible slots
          const slots = generateTimeSlots(hours.open, hours.close);
          
          // Mark slots as unavailable if there's a booking
          const dayBookings = bookings?.filter(b => 
            b.court_id === court.id && 
            isSameDay(parseISO(b.start_time), date)
          ) || [];
          
          slots.forEach(slot => {
            const slotStart = `${format(date, 'yyyy-MM-dd')}T${slot.startTime}:00`;
            const slotEnd = `${format(date, 'yyyy-MM-dd')}T${slot.endTime}:00`;
            
            // Check if any booking overlaps with this slot
            const overlappingBooking = dayBookings.find(booking => {
              const bookingStart = parseISO(booking.start_time);
              const bookingEnd = parseISO(booking.end_time);
              const slotStartDate = parseISO(slotStart);
              const slotEndDate = parseISO(slotEnd);
              
              return (slotStartDate < bookingEnd && slotEndDate > bookingStart);
            });
            
            if (overlappingBooking) {
              slot.isAvailable = false;
              slot.bookingId = overlappingBooking.id;
            }
          });
          
          return { court, slots };
        });
        
        days.push({ date, courts: courtAvailabilities });
      }
      
      setAvailability(days);
    } catch (err) {
      console.error('Error calculating availability:', err);
    } finally {
      setLoading(false);
    }
  }, [venueId, courts, hoursOfOperation]);

  return { availability, loading, fetchAvailability };
}
