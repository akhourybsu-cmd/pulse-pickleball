import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, startOfToday, isSameDay, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import { MapPin, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
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

// Animation variants
const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 }
  }
};

const eventCardVariant = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }
  }
};

export function PublicEventsTab({ venue, events, onRegister, registeredEventIds = [] }: PublicEventsTabProps) {
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [visibleDate, setVisibleDate] = useState(startOfToday());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Separate refs: sections for scrolling TO, headers for detecting which is at top
  const sectionRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const headerRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
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

  // Handle scroll to update visible date - detect which section is at the top
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingToDate.current) return;
      
      const scrollTop = container.scrollTop;
      let currentDateKey: string | null = null;
      
      // Find which section we're currently in based on scroll position
      // We iterate through sections and find the one whose top is at or above scrollTop
      const entries = Array.from(sectionRefsMap.current.entries());
      
      for (let i = 0; i < entries.length; i++) {
        const [dateKey, element] = entries[i];
        const sectionTop = element.offsetTop;
        const nextSection = entries[i + 1];
        const sectionBottom = nextSection ? nextSection[1].offsetTop : sectionTop + element.offsetHeight;
        
        // If scroll position is within this section (with small buffer for sticky header)
        if (scrollTop >= sectionTop - 10 && scrollTop < sectionBottom - 10) {
          currentDateKey = dateKey;
          break;
        }
      }
      
      // Fallback to first section if at the very top
      if (!currentDateKey && entries.length > 0 && scrollTop < 50) {
        currentDateKey = entries[0][0];
      }
      
      if (currentDateKey) {
        const date = parseISO(currentDateKey);
        if (!isSameDay(date, visibleDate)) {
          setVisibleDate(date);
          setSelectedDate(date);
        }
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => container.removeEventListener('scroll', handleScroll);
  }, [visibleDate]);

  // Scroll to date when picker is used
  const scrollToDate = useCallback((date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const element = sectionRefsMap.current.get(dateKey);
    
    if (element && scrollContainerRef.current) {
      isScrollingToDate.current = true;
      
      // Use offsetTop for accurate positioning - scrolls section to top of container
      scrollContainerRef.current.scrollTo({
        top: element.offsetTop,
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
          accentColor={primaryColor}
        />
      </div>

      {/* Category Filter Pills */}
      <div className="sticky top-[52px] z-20 bg-secondary px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category.id;
            return (
              <motion.button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all",
                  isSelected 
                    ? "bg-card text-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {category.label}
              </motion.button>
            );
          })}
        </div>
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
                  sectionRefsMap.current.set(dateKey, el);
                } else {
                  sectionRefsMap.current.delete(dateKey);
                }
              }}
            >
              {/* Date Section Header - sticks below category filters */}
              <div 
                ref={(el) => {
                  if (el) {
                    headerRefsMap.current.set(dateKey, el);
                  } else {
                    headerRefsMap.current.delete(dateKey);
                  }
                }}
                className="sticky top-0 z-[5] bg-muted/95 backdrop-blur-sm px-4 py-3 border-b border-border"
              >
                <h3 className="text-base font-semibold text-foreground">
                  {getDateLabel(date)}
                </h3>
              </div>
              
              {/* Events for this date */}
              {dayEvents.length === 0 ? (
                <div className="py-8 px-4 text-center text-muted-foreground text-sm">
                  No events scheduled
                </div>
              ) : (
                <motion.div 
                  variants={staggerContainer}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.1 }}
                  className="divide-y divide-border"
                >
                  {dayEvents.map((event) => {
                    const isRegistered = registeredEventIds.includes(event.id);
                    const spotsLeft = event.max_participants 
                      ? event.max_participants - event.current_participants 
                      : null;
                    const isFull = spotsLeft !== null && spotsLeft <= 0;
                    const isLowSpots = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3;
                    
                    return (
                      <motion.button
                        key={event.id}
                        variants={eventCardVariant}
                        onClick={() => onRegister(event)}
                        whileHover={{ backgroundColor: 'rgba(var(--muted), 0.5)' }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full px-4 py-4 text-left transition-colors"
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
                            <motion.div
                              animate={{ 
                                boxShadow: [
                                  '0 0 0 0 rgba(220, 38, 38, 0)',
                                  '0 0 0 4px rgba(220, 38, 38, 0.2)',
                                  '0 0 0 0 rgba(220, 38, 38, 0)'
                                ]
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className="rounded"
                            >
                              <Badge className="bg-red-600 text-white text-xs">ONLY {spotsLeft} SPOTS LEFT</Badge>
                            </motion.div>
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
                      </motion.button>
                    );
                  })}
                </motion.div>
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
