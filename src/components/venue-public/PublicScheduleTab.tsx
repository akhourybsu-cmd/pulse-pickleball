import { useState, useEffect, useMemo } from 'react';
import { format, isSameDay, parseISO } from 'date-fns';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCourt, VenueEvent } from '@/hooks/usePublicVenue';
import { useVenueAvailability, TimeSlot } from '@/hooks/useVenueAvailability';
import { DatePickerStrip } from './DatePickerStrip';
import { OrderSummaryDialog } from './OrderSummaryDialog';

interface PublicScheduleTabProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  onSelectSlot: (court: VenueCourt, date: Date, slot: TimeSlot, duration?: number) => void;
  isAuthenticated?: boolean;
}

interface AggregatedSlot {
  startTime: string;
  availableCourts: VenueCourt[];
  isPeak: boolean;
  isPast: boolean;
}

export function PublicScheduleTab({ venue, courts, onSelectSlot, isAuthenticated = false }: PublicScheduleTabProps) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [dayEvents, setDayEvents] = useState<VenueEvent[]>([]);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  
  const primaryColor = venue.primary_color || '#FF6B35';
  
  const { availability, loading, fetchAvailability } = useVenueAvailability({
    venueId: venue.id,
    courts,
    hoursOfOperation: venue.hours_of_operation,
  });

  useEffect(() => {
    fetchAvailability(selectedDate, 14);
  }, [selectedDate, fetchAvailability]);

  // Fetch events for selected date
  useEffect(() => {
    const fetchDayEvents = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { data } = await supabase
        .from('venue_events')
        .select('id, title, description, start_time, end_time, max_participants, current_participants, price, event_type, skill_level')
        .eq('venue_id', venue.id)
        .eq('is_published', true)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`)
        .order('start_time');
      
      setDayEvents((data || []) as VenueEvent[]);
    };
    
    fetchDayEvents();
  }, [selectedDate, venue.id]);

  // Get availability for selected date
  const dayAvailability = availability.find(day => isSameDay(day.date, selectedDate));

  // Determine if a time is peak hours (5pm-9pm weekdays, 9am-5pm weekends)
  const isPeakTime = (time: string, date: Date) => {
    const hour = parseInt(time.split(':')[0]);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    
    if (isWeekend) {
      return hour >= 9 && hour < 17; // 9am-5pm weekends
    }
    return hour >= 17 && hour < 21; // 5pm-9pm weekdays
  };

  // Aggregate slots across all courts
  const aggregatedSlots = useMemo(() => {
    if (!dayAvailability) return [];
    
    const slotMap = new Map<string, VenueCourt[]>();
    
    dayAvailability.courts.forEach(courtData => {
      courtData.slots.forEach(slot => {
        if (slot.isAvailable) {
          const existing = slotMap.get(slot.startTime) || [];
          existing.push(courtData.court);
          slotMap.set(slot.startTime, existing);
        }
      });
    });
    
    const now = new Date();
    return Array.from(slotMap.entries())
      .map(([startTime, availableCourts]): AggregatedSlot => {
        const slotDateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${startTime}`);
        return {
          startTime,
          availableCourts,
          isPeak: isPeakTime(startTime, selectedDate),
          isPast: slotDateTime < now,
        };
      })
      .filter(slot => !slot.isPast)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [dayAvailability, selectedDate]);

  // Handle slot toggle (multi-select)
  const handleSlotToggle = (time: string) => {
    setSelectedSlots(prev => {
      if (prev.includes(time)) {
        return prev.filter(t => t !== time);
      }
      // Add the slot and sort to maintain order
      const newSlots = [...prev, time].sort();
      return newSlots;
    });
  };

  // Get available courts for all selected slots (intersection)
  const availableCourtsForSelection = useMemo(() => {
    if (selectedSlots.length === 0) return [];
    
    const courtSets = selectedSlots.map(time => {
      const slot = aggregatedSlots.find(s => s.startTime === time);
      return new Set(slot?.availableCourts.map(c => c.id) || []);
    });
    
    // Get intersection of all court sets
    const intersection = courtSets.reduce((acc, set) => {
      return new Set([...acc].filter(id => set.has(id)));
    });
    
    // Return full court objects
    return courts.filter(c => intersection.has(c.id));
  }, [selectedSlots, aggregatedSlots, courts]);

  // Format time for display (12:30pm format)
  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  // Calculate total duration
  const totalDuration = selectedSlots.length * 0.5;
  const baseRate = courts[0]?.hourly_rate || 30;
  const estimatedPrice = baseRate * totalDuration;

  return (
    <div className="flex flex-col h-full">
      {/* Date Picker Strip */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4">
        <DatePickerStrip 
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSelectedSlots([]);
          }}
        />
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground">
          {selectedSlots.length > 0 
            ? `${selectedSlots.length} slot${selectedSlots.length > 1 ? 's' : ''} selected (${totalDuration} hr${totalDuration !== 1 ? 's' : ''}) • ~$${estimatedPrice.toFixed(0)}`
            : 'Tap to select time slots (multi-select for longer sessions)'
          }
        </p>
      </div>

      {/* Time Slots List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading availability...</p>
          </div>
        ) : aggregatedSlots.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No available time slots for this day</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {aggregatedSlots.map((slot) => {
              const isSelected = selectedSlots.includes(slot.startTime);
              const courtNames = slot.availableCourts.map(c => c.name.replace('Court ', 'C')).join('/');
              
              return (
                <label 
                  key={slot.startTime}
                  className={cn(
                    "flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors",
                    isSelected && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-4">
                    {/* Time */}
                    <span className="text-base font-medium w-20">
                      {formatTimeDisplay(slot.startTime)}
                    </span>
                    
                    {/* Peak/Off-Peak Badge */}
                    <Badge 
                      variant="secondary" 
                      className={cn(
                        "text-xs font-medium",
                        slot.isPeak 
                          ? "bg-slate-800 text-white dark:bg-slate-700" 
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      )}
                    >
                      {slot.isPeak ? 'PEAK' : 'OFF PEAK'}
                    </Badge>
                    
                    {/* Available Courts */}
                    <span className="text-sm text-muted-foreground hidden sm:inline">
                      {slot.availableCourts.length} court{slot.availableCourts.length !== 1 ? 's' : ''} ({courtNames})
                    </span>
                  </div>
                  
                  {/* Larger Checkbox/Circle */}
                  <div 
                    className={cn(
                      "w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all shrink-0",
                      isSelected 
                        ? "border-primary bg-primary" 
                        : "border-muted-foreground/40 bg-background hover:border-primary/60"
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSlotToggle(slot.startTime);
                    }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </label>
              );
            })}
          </div>
        )}
        
        {/* Event Pills for Selected Day */}
        {dayEvents.length > 0 && (
          <div className="px-4 py-4 border-t border-border mt-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              Events scheduled today
            </p>
            <div className="flex flex-wrap gap-2">
              {dayEvents.map((event) => (
                <Badge 
                  key={event.id} 
                  variant="outline"
                  className="text-xs"
                >
                  {event.title} • {format(parseISO(event.start_time), 'h:mma')}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Extra padding for bottom button */}
        <div className="h-24" />
      </ScrollArea>

      {/* Continue Button (Fixed at bottom) */}
      {selectedSlots.length > 0 && (
        <div className="sticky bottom-0 p-4 bg-background border-t border-border">
          <Button
            className="w-full h-12 text-base font-medium"
            onClick={() => setOrderSummaryOpen(true)}
            style={{ backgroundColor: primaryColor }}
          >
            Continue to Booking • ${estimatedPrice.toFixed(0)}
          </Button>
        </div>
      )}

      {/* Order Summary Dialog */}
      <OrderSummaryDialog
        open={orderSummaryOpen}
        onOpenChange={setOrderSummaryOpen}
        venue={venue}
        availableCourts={availableCourtsForSelection}
        date={selectedDate}
        selectedSlots={selectedSlots}
        isAuthenticated={isAuthenticated}
        onAddMoreTime={() => {
          setOrderSummaryOpen(false);
        }}
      />
    </div>
  );
}
