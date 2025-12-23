import { useState, useEffect, useMemo } from 'react';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { Circle, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCourt, VenueEvent } from '@/hooks/usePublicVenue';
import { useVenueAvailability, TimeSlot } from '@/hooks/useVenueAvailability';
import { DatePickerStrip } from './DatePickerStrip';

interface PublicScheduleTabProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  onSelectSlot: (court: VenueCourt, date: Date, slot: TimeSlot, duration?: number) => void;
}

interface AggregatedSlot {
  startTime: string;
  availableCourts: VenueCourt[];
  isPeak: boolean;
  isPast: boolean;
}

export function PublicScheduleTab({ venue, courts, onSelectSlot }: PublicScheduleTabProps) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedSlotTime, setSelectedSlotTime] = useState<string | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<VenueCourt | null>(null);
  const [dayEvents, setDayEvents] = useState<VenueEvent[]>([]);
  
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

  // Get courts for selected time slot
  const selectedSlot = aggregatedSlots.find(s => s.startTime === selectedSlotTime);

  // Handle slot selection
  const handleSlotSelect = (time: string) => {
    setSelectedSlotTime(time);
    setSelectedCourt(null);
  };

  // Handle court selection and trigger booking
  const handleCourtSelect = (court: VenueCourt) => {
    setSelectedCourt(court);
    const slot = dayAvailability?.courts
      .find(c => c.court.id === court.id)?.slots
      .find(s => s.startTime === selectedSlotTime);
    
    if (slot) {
      onSelectSlot(court, selectedDate, slot);
    }
  };

  // Format time for display (12:30pm format)
  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Date Picker Strip */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4">
        <DatePickerStrip 
          selectedDate={selectedDate}
          onSelectDate={(date) => {
            setSelectedDate(date);
            setSelectedSlotTime(null);
            setSelectedCourt(null);
          }}
        />
      </div>

      {/* Info Banner */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground">
          {selectedSlotTime 
            ? `Selected: ${formatTimeDisplay(selectedSlotTime)} • Choose a court below`
            : 'Select a time slot to book a court'
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
          <RadioGroup 
            value={selectedSlotTime || ''} 
            onValueChange={handleSlotSelect}
            className="divide-y divide-border"
          >
            {aggregatedSlots.map((slot) => {
              const isSelected = selectedSlotTime === slot.startTime;
              const courtNames = slot.availableCourts.map(c => c.name.replace('Court ', 'C')).join('/');
              
              return (
                <div key={slot.startTime}>
                  <label 
                    className={cn(
                      "flex items-center justify-between px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      isSelected && "bg-muted/50"
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
                      <span className="text-sm text-muted-foreground">
                        {slot.availableCourts.length} open court{slot.availableCourts.length !== 1 ? 's' : ''} ({courtNames})
                      </span>
                    </div>
                    
                    {/* Radio Button */}
                    <RadioGroupItem value={slot.startTime} className="shrink-0" />
                  </label>
                  
                  {/* Court Selection (shown when slot is selected) */}
                  {isSelected && (
                    <div className="px-4 pb-4 bg-muted/30">
                      <p className="text-sm text-muted-foreground mb-2 pt-2">Choose a court:</p>
                      <div className="flex flex-wrap gap-2">
                        {slot.availableCourts.map((court) => (
                          <button
                            key={court.id}
                            onClick={() => handleCourtSelect(court)}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all",
                              selectedCourt?.id === court.id
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background hover:border-primary/50"
                            )}
                          >
                            <span className="font-medium">{court.name}</span>
                            {court.hourly_rate && (
                              <span className="text-sm text-muted-foreground">
                                ${court.hourly_rate}/hr
                              </span>
                            )}
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </RadioGroup>
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
        
        {/* Extra padding */}
        <div className="h-8" />
      </ScrollArea>
    </div>
  );
}
