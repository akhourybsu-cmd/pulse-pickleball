import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, Users, Trophy, Gamepad2, GraduationCap, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDiscoverEvents, EventTypeFilter, DateRangeFilter } from "@/hooks/useDiscoverEvents";
import { UnifiedEventCard } from "@/components/events/UnifiedEventCard";
import { useAuthState } from "@/hooks/useAuthState";

const eventTypeFilters: { value: EventTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All Events', icon: <Calendar className="w-4 h-4" /> },
  { value: 'round_robin', label: 'Round Robin', icon: <Users className="w-4 h-4" /> },
  { value: 'tournament', label: 'Tournament', icon: <Trophy className="w-4 h-4" /> },
  { value: 'open_play', label: 'Open Play', icon: <Gamepad2 className="w-4 h-4" /> },
  { value: 'clinic', label: 'Clinic', icon: <GraduationCap className="w-4 h-4" /> },
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
    state: profile?.player_state ? undefined : undefined, // Could use location here
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
      {/* Header */}
      <div className="bg-gradient-to-b from-primary/10 to-background pt-6 pb-4 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-1">Find Events</h1>
          <p className="text-sm text-muted-foreground mb-4">
            Discover round robins, tournaments, clinics, and more near you
          </p>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events, venues, or locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-card border-border"
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className={cn("w-4 h-4", showFilters && "text-primary")} />
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-3">
          {/* Event Type Chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {eventTypeFilters.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setEventType(filter.value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                  eventType === filter.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {filter.icon}
                {filter.label}
              </button>
            ))}
          </div>

          {/* Date Range Chips - Show when filters expanded */}
          {showFilters && (
            <div className="flex gap-2 pt-2 overflow-x-auto -mx-4 px-4 scrollbar-hide">
              {dateRangeFilters.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDateRange(filter.value)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border",
                    dateRange === filter.value
                      ? "bg-secondary text-secondary-foreground border-secondary"
                      : "bg-transparent text-muted-foreground border-border hover:border-primary/50"
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
      <div className="max-w-3xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Failed to load events</p>
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No events found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery 
                ? "Try adjusting your search or filters"
                : "Check back later for new events in your area"
              }
            </p>
            {searchQuery && (
              <Button variant="outline" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} found
              </p>
              {(eventType !== 'all' || dateRange !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEventType('all');
                    setDateRange('all');
                  }}
                  className="text-xs"
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
                  // Navigate based on event type
                  if (event.event_type === 'round_robin') {
                    navigate(`/round-robin/${event.id}`);
                  } else if (event.event_type === 'tournament') {
                    navigate(`/tournaments/${event.id}`);
                  } else {
                    // Generic event detail - could create a unified detail page
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
