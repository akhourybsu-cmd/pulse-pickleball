import { useState, useMemo } from 'react';
import { format, startOfToday, isSameDay, parseISO, isToday, isTomorrow } from 'date-fns';
import { MapPin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { PublicVenue, VenueEvent } from '@/hooks/usePublicVenue';
import { DatePickerStrip } from './DatePickerStrip';

interface PublicEventsTabProps {
  venue: PublicVenue;
  events: VenueEvent[];
  onRegister: (event: VenueEvent) => void;
  registeredEventIds?: string[];
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'open_play', label: 'Open Play' },
  { id: 'clinic', label: 'Clinics' },
  { id: 'league', label: 'Leagues' },
  { id: 'tournament', label: 'Tournaments' },
  { id: 'social', label: 'Social' },
];

export function PublicEventsTab({ venue, events, onRegister, registeredEventIds = [] }: PublicEventsTabProps) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const primaryColor = venue.primary_color || '#FF6B35';

  // Get event dot color based on type
  const getEventDotColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'open_play': return 'bg-emerald-500';
      case 'clinic': return 'bg-blue-500';
      case 'league': return 'bg-purple-500';
      case 'tournament': return 'bg-red-500';
      case 'social': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  // Filter events by date and category
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_time);
      if (!isSameDay(eventDate, selectedDate)) return false;
      
      if (selectedCategory !== 'all') {
        if (event.event_type.toLowerCase() !== selectedCategory) return false;
      }
      
      return true;
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }, [events, selectedDate, selectedCategory]);

  // Get section header text
  const getSectionHeader = () => {
    if (isToday(selectedDate)) return 'Today';
    if (isTomorrow(selectedDate)) return 'Tomorrow';
    return format(selectedDate, 'EEEE, MMMM d');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Date Picker Strip */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pt-4">
        <DatePickerStrip 
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>

      {/* Category Filter Pills */}
      <div className="bg-slate-900 dark:bg-slate-950 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  isSelected 
                    ? "bg-white text-slate-900" 
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-500">
          {getSectionHeader()}
        </h2>
      </div>

      {/* Events List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 px-4">
              <p className="text-muted-foreground">
                No events scheduled for this day
              </p>
            </div>
          ) : (
            filteredEvents.map((event) => {
              const isRegistered = registeredEventIds.includes(event.id);
              const spotsLeft = event.max_participants 
                ? event.max_participants - event.current_participants 
                : null;
              const isFull = spotsLeft !== null && spotsLeft <= 0;
              const isLowSpots = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3;
              
              return (
                <button
                  key={event.id}
                  onClick={() => onRegister(event)}
                  className="w-full px-4 py-4 text-left hover:bg-muted/50 transition-colors"
                >
                  {/* Top Row: Time + Status Badge */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", getEventDotColor(event.event_type))} />
                      <span className="text-sm text-muted-foreground">
                        {format(parseISO(event.start_time), 'h:mm a')} - {format(parseISO(event.end_time), 'h:mm a')}
                      </span>
                    </div>
                    {isRegistered ? (
                      <Badge className="bg-emerald-600 text-white text-xs">REGISTERED</Badge>
                    ) : isFull ? (
                      <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">WAITLIST</Badge>
                    ) : isLowSpots ? (
                      <Badge className="bg-red-600 text-white text-xs">ONLY {spotsLeft} SPOTS LEFT</Badge>
                    ) : null}
                  </div>
                  
                  {/* Title */}
                  <h3 className="font-semibold text-foreground mb-2">{event.title}</h3>
                  
                  {/* Bottom Row: Location + Skill Level + Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {venue.name}
                      </span>
                      {event.skill_level && (
                        <span className="text-xs bg-muted px-2 py-0.5 rounded">
                          {event.skill_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {event.price !== null && event.price > 0 && (
                        <span className="font-semibold" style={{ color: primaryColor }}>
                          ${event.price}
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
        
        {/* Extra padding */}
        <div className="h-8" />
      </ScrollArea>
    </div>
  );
}
