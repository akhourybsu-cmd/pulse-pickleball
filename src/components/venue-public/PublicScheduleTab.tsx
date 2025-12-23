import { useState, useEffect } from 'react';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCourt, VenueEvent } from '@/hooks/usePublicVenue';
import { useVenueAvailability, TimeSlot } from '@/hooks/useVenueAvailability';

interface PublicScheduleTabProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  onSelectSlot: (court: VenueCourt, date: Date, slot: TimeSlot, duration?: number) => void;
}

export function PublicScheduleTab({ venue, courts, onSelectSlot }: PublicScheduleTabProps) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedCourt, setSelectedCourt] = useState<VenueCourt | null>(null);
  const [dateOffset, setDateOffset] = useState(0);
  const [dayEvents, setDayEvents] = useState<VenueEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';
  
  const { availability, loading, fetchAvailability } = useVenueAvailability({
    venueId: venue.id,
    courts,
    hoursOfOperation: venue.hours_of_operation,
  });

  useEffect(() => {
    const startDate = addDays(startOfToday(), dateOffset);
    fetchAvailability(startDate, 7);
  }, [dateOffset, fetchAvailability]);

  // Fetch events for selected date
  useEffect(() => {
    const fetchDayEvents = async () => {
      setEventsLoading(true);
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
      setEventsLoading(false);
    };
    
    fetchDayEvents();
  }, [selectedDate, venue.id]);

  // Generate dates for the date picker
  const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), dateOffset + i));

  // Get availability for selected date
  const dayAvailability = availability.find(day => isSameDay(day.date, selectedDate));

  // Get slots for selected court
  const courtSlots = selectedCourt 
    ? dayAvailability?.courts.find(c => c.court.id === selectedCourt.id)?.slots || []
    : [];

  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'tournament': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'clinic': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'social': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'league': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Date Picker */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDateOffset(prev => Math.max(0, prev - 7))}
            disabled={dateOffset === 0}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {format(dates[0], 'MMM yyyy')}
          </span>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDateOffset(prev => prev + 7)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {dates.map((date) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, startOfToday());
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-xl transition-all",
                  isSelected 
                    ? "text-white shadow-md" 
                    : "bg-muted/50 text-foreground hover:bg-muted"
                )}
                style={isSelected ? { backgroundColor: primaryColor } : undefined}
              >
                <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
                <span className="text-lg font-bold">{format(date, 'd')}</span>
                {isToday && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: primaryColor }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Court Selector */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-sm text-muted-foreground mb-2">Select a court</p>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {courts.map((court) => {
            const isSelected = selectedCourt?.id === court.id;
            return (
              <button
                key={court.id}
                onClick={() => setSelectedCourt(court)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all border-2",
                  isSelected 
                    ? "text-white border-transparent" 
                    : "bg-background text-foreground border-border hover:border-primary/50"
                )}
                style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
              >
                {court.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Pills for Selected Day */}
      {dayEvents.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Events on {format(selectedDate, 'MMM d')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {dayEvents.map((event) => (
              <Badge 
                key={event.id} 
                variant="secondary"
                className={cn("text-xs", getEventTypeColor(event.event_type))}
              >
                {event.title} • {format(parseISO(event.start_time), 'h:mma')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Time Slots */}
      <ScrollArea className="flex-1 px-4">
        <div className="py-4">
          {!selectedCourt ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Select a court to see available times</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading availability...</p>
            </div>
          ) : courtSlots.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No time slots available for this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground mb-3">
                Available times for {format(selectedDate, 'EEEE, MMMM d')}
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {courtSlots.map((slot, idx) => {
                  const isPast = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${slot.startTime}`) < new Date();
                  const isDisabled = !slot.isAvailable || isPast;
                  
                  return (
                    <button
                      key={idx}
                      disabled={isDisabled}
                      onClick={() => onSelectSlot(selectedCourt, selectedDate, slot)}
                      className={cn(
                        "relative p-3 rounded-lg border-2 text-center transition-all",
                        isDisabled
                          ? "bg-muted/50 border-muted text-muted-foreground cursor-not-allowed opacity-50"
                          : "bg-background border-border hover:border-primary hover:shadow-sm"
                      )}
                    >
                      <span className="text-sm font-medium">{slot.startTime}</span>
                      {!slot.isAvailable && !isPast && (
                        <Badge variant="secondary" className="absolute -top-1 -right-1 text-[10px] px-1">
                          Booked
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Price info */}
        {selectedCourt?.hourly_rate && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Hourly Rate</span>
                <span className="font-semibold" style={{ color: primaryColor }}>
                  ${selectedCourt.hourly_rate}/hour
                </span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Extra padding */}
        <div className="h-8" />
      </ScrollArea>
    </div>
  );
}
