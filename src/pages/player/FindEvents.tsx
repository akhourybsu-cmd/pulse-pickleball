import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Users, Trophy, Gamepad2, GraduationCap, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDiscoverEvents, EventTypeFilter, DateRangeFilter } from "@/hooks/useDiscoverEvents";
import { UnifiedEventCard } from "@/components/events/UnifiedEventCard";
import { useAuthState } from "@/hooks/useAuthState";

const eventTypeFilters: { value: EventTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: 'round_robin', label: 'Round Robin', icon: <Users className="w-3.5 h-3.5" /> },
  { value: 'tournament', label: 'Tournament', icon: <Trophy className="w-3.5 h-3.5" /> },
  { value: 'open_play', label: 'Open Play', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { value: 'clinic', label: 'Clinic', icon: <GraduationCap className="w-3.5 h-3.5" /> },
];

const dateRangeFilters: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'Any Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

export default function FindEvents() {
  const navigate = useNavigate();
  const { profile } = useAuthState();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [eventType, setEventType] = useState<EventTypeFilter>('all');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [showFilters, setShowFilters] = useState(false);

  // Use player's location from profile for filtering
  const { data: events, isLoading, error } = useDiscoverEvents({
    eventType,
    dateRange,
    state: profile?.player_state ? undefined : undefined,
    limit: 50,
  });

  // Client-side search filtering
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!searchQuery.trim()) return events;

    const query = searchQuery.toLowerCase();
    return events.filter(event =>
      event.title.toLowerCase().includes(query) ||
      event.venue_name?.toLowerCase().includes(query) ||
      event.venue_city?.toLowerCase().includes(query) ||
      event.description?.toLowerCase().includes(query)
    );
  }, [events, searchQuery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Refined Header - Premium Polish */}
      <div className="bg-gradient-to-b from-muted/20 to-background pt-4 pb-3 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h1 className="page-title">Find Events</h1>
          <p className="page-subtitle mt-0.5 mb-3">
            Discover round robins, tournaments, and more
          </p>

          {/* Search Bar - Premium Polish */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
            <Input
              placeholder="Search events, venues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 input-premium text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-muted/50"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className={cn("w-4 h-4 transition-colors", showFilters && "text-primary")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters - Refined chips */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/30">
        <div className="max-w-3xl mx-auto px-4 py-2.5">
          {/* Event Type Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {eventTypeFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setEventType(filter.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                  eventType === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>

          {/* Date Range Chips - Show when filters expanded */}
          {showFilters && (
            <div className="flex gap-1.5 pt-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
              {dateRangeFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDateRange(filter.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                    dateRange === filter.value
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-transparent text-muted-foreground border-border/40 hover:border-primary/30"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-3xl mx-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Failed to load events</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-5 h-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">No events found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search"
                : "Check back later for new events"
              }
            </p>
            {searchQuery && (
              <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
              </p>
              {(eventType !== 'all' || dateRange !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEventType('all');
                    setDateRange('all');
                  }}
                  className="text-xs h-7"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Event Cards */}
            {filteredEvents.map((event) => (
              <UnifiedEventCard
                key={event.id}
                event={event}
                onClick={() => {
                  if (event.event_type === 'round_robin') {
                    navigate(`/round-robin/${event.id}`);
                  } else if (event.event_type === 'tournament') {
                    navigate(`/tournament/${event.id}`);
                  } else {
                    navigate(`/events/${event.id}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
