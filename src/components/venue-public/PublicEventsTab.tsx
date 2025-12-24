import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, startOfToday, isSameDay, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { MapPin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

const NUMBER_OF_DAYS = 14;

export function PublicEventsTab({ venue, events, onRegister, registeredEventIds = [] }: PublicEventsTabProps) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visibleDate, setVisibleDate] = useState(startOfToday());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const dateRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const isScrollingToDate = useRef(false);
  
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

  // Generate dates for the next N days
  const dates = useMemo(() => 
    Array.from({ length: NUMBER_OF_DAYS }, (_, i) => addDays(startOfToday(), i)),
    []
  );

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, VenueEvent[]>();
    
    dates.forEach(date => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const dayEvents = events.filter(event => {
        const eventDate = parseISO(event.start_time);
        if (!isSameDay(eventDate, date)) return false;
        
        if (selectedCategory !== 'all') {
          if (event.event_type.toLowerCase() !== selectedCategory) return false;
        }
        
        return true;
      }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      
      grouped.set(dateKey, dayEvents);
    });
    
    return grouped;
  }, [events, dates, selectedCategory]);

  // Get date label for display
  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d');
  };

  // Handle scroll to update visible date
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingToDate.current) return;
        
        // Find the first visible section
        const visibleEntries = entries.filter(entry => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by top position to get the topmost visible section
          const sorted = visibleEntries.sort((a, b) => {
            const rectA = a.boundingClientRect;
            const rectB = b.boundingClientRect;
            return rectA.top - rectB.top;
          });
          
          const topEntry = sorted[0];
          const dateKey = topEntry.target.getAttribute('data-date');
          if (dateKey) {
            const date = parseISO(dateKey);
            setVisibleDate(date);
            setSelectedDate(date);
          }
        }
      },
      { 
        root: container,
        rootMargin: '-80px 0px -80% 0px',
        threshold: 0
      }
    );
    
    // Observe all date section headers
    dateRefsMap.current.forEach((element) => {
      observer.observe(element);
    });
    
    return () => observer.disconnect();
  }, [eventsByDate]);

  // Scroll to date when picker is used
  const scrollToDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const element = dateRefsMap.current.get(dateKey);
    
    if (element && scrollContainerRef.current) {
      isScrollingToDate.current = true;
      
      // Calculate scroll position with offset for sticky headers
      const container = scrollContainerRef.current;
      const containerTop = container.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const scrollOffset = container.scrollTop + (elementTop - containerTop);
      
      container.scrollTo({
        top: scrollOffset,
        behavior: 'smooth'
      });
      
      setSelectedDate(date);
      setVisibleDate(date);
      
      // Reset flag after scroll animation
      setTimeout(() => {
        isScrollingToDate.current = false;
      }, 500);
    }
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Date Picker Strip */}
      <div className="sticky top-0 z-30 bg-background border-b border-border px-4 pt-4">
        <DatePickerStrip 
          selectedDate={selectedDate}
          onSelectDate={scrollToDate}
        />
      </div>

      {/* Category Filter Pills */}
      <div className="sticky top-[52px] z-20 bg-slate-900 dark:bg-slate-950 px-4 py-3">
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

      {/* Current Visible Date Header (sticky overlay) */}
      <div className="sticky top-[100px] z-10 bg-background border-b border-border px-4 py-3 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-600 dark:text-amber-500">
          {getDateLabel(visibleDate)}
        </h2>
      </div>

      {/* Events List - Scrollable Container */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {Array.from(eventsByDate.entries()).map(([dateKey, dayEvents]) => {
          const date = parseISO(dateKey);
          
          return (
            <div 
              key={dateKey}
              data-date={dateKey}
              ref={(el) => {
                if (el) {
                  dateRefsMap.current.set(dateKey, el);
                } else {
                  dateRefsMap.current.delete(dateKey);
                }
              }}
            >
              {/* Date Section Header */}
              <div className="sticky top-0 z-[5] bg-muted/80 backdrop-blur-sm px-4 py-2 border-b border-border">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {getDateLabel(date)}
                </h3>
              </div>
              
              {/* Events for this date */}
              {dayEvents.length === 0 ? (
                <div className="py-8 px-4 text-center text-muted-foreground text-sm">
                  No events scheduled
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {dayEvents.map((event) => {
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
                  })}
                </div>
              )}
            </div>
          );
        })}
        
        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
