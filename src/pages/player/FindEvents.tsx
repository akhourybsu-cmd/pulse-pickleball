import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Calendar, Users, Gamepad2, GraduationCap, Star, Sparkles, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDiscoverEvents, EventTypeFilter, DateRangeFilter } from "@/hooks/useDiscoverEvents";
import { UnifiedEventCard } from "@/components/events/UnifiedEventCard";
import { PlayContextBar } from "@/components/play/PlayContextBar";

// Player-side event type chips. Tournament was removed as part of the player/
// venue separation — tournament discovery lives behind the mode toggle on the
// venue side. The `tournament` value is still in EventTypeFilter (so existing
// `?type=tournament` deep links don't crash readTypeParam), but it's hidden
// from the chip list, and the hook excludes tournament rows when `type=all`.
const eventTypeFilters: { value: EventTypeFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: 'All', icon: <Calendar className="w-3.5 h-3.5" /> },
  { value: 'round_robin', label: 'Round Robin', icon: <Users className="w-3.5 h-3.5" /> },
  { value: 'open_play', label: 'Open Play', icon: <Gamepad2 className="w-3.5 h-3.5" /> },
  { value: 'clinic', label: 'Clinic', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { value: 'league', label: 'League', icon: <Star className="w-3.5 h-3.5" /> },
  { value: 'social', label: 'Social', icon: <Sparkles className="w-3.5 h-3.5" /> },
];

const dateRangeFilters: { value: DateRangeFilter; label: string }[] = [
  { value: 'all', label: 'Any Time' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
];

interface FindEventsProps {
  hideHeader?: boolean;
}

// Validate that a URL `type` param is a known filter value.
const KNOWN_EVENT_TYPES: ReadonlySet<EventTypeFilter> = new Set([
  'all', 'round_robin', 'tournament', 'open_play', 'clinic', 'league', 'social',
]);
function readTypeParam(value: string | null): EventTypeFilter {
  if (value && KNOWN_EVENT_TYPES.has(value as EventTypeFilter)) {
    return value as EventTypeFilter;
  }
  return 'all';
}

const KNOWN_DATE_RANGES: ReadonlySet<DateRangeFilter> = new Set([
  'all', 'today', 'this_week', 'this_month',
]);
function readDateRangeParam(value: string | null): DateRangeFilter {
  if (value && KNOWN_DATE_RANGES.has(value as DateRangeFilter)) {
    return value as DateRangeFilter;
  }
  return 'all';
}

export default function FindEvents({ hideHeader = false }: FindEventsProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven filter state — deep links / refreshes preserve filters.
  const [searchQuery, setSearchQueryState] = useState<string>(() => searchParams.get('q') ?? '');
  const [eventType, setEventTypeState] = useState<EventTypeFilter>(() =>
    readTypeParam(searchParams.get('type'))
  );
  const [dateRange, setDateRangeState] = useState<DateRangeFilter>(() =>
    readDateRangeParam(searchParams.get('when'))
  );
  // When a non-default date range arrives via URL, expand the filter panel
  // so the user can see which date filter is active.
  const [showFilters, setShowFilters] = useState(() =>
    readDateRangeParam(searchParams.get('when')) !== 'all'
  );

  /**
   * Sync a single filter to the URL while preserving the other params.
   * All three filter setters go through this so the URL stays in lockstep
   * with state and deep links remain shareable.
   */
  const syncParam = (key: 'type' | 'when' | 'q', value: string, defaultValue: string) => {
    const params = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params, { replace: true });
  };

  const setEventType = (next: EventTypeFilter) => {
    setEventTypeState(next);
    syncParam('type', next, 'all');
  };
  const setDateRange = (next: DateRangeFilter) => {
    setDateRangeState(next);
    syncParam('when', next, 'all');
  };
  const setSearchQuery = (next: string) => {
    setSearchQueryState(next);
    syncParam('q', next, '');
  };

  const { data: events, isLoading, error } = useDiscoverEvents({
    eventType,
    // Exclude tournament events from the player-side feed — tournaments are
    // a venue/organizer concern now. If a user arrives via legacy
    // /player/play?type=tournament deep link, eventType wins over the
    // exclusion list (handled in the hook), so they still see their target.
    excludeEventTypes: ['tournament'],
    dateRange,
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

  // Per-filter empty-state copy. Honest language — no fake distances or
  // "near you" claims, just useful next-steps for whatever filter is active.
  const emptyStateCopy: Record<EventTypeFilter, { title: string; description: string }> = {
    all: {
      title: "No events found",
      description: "No upcoming events match your filters. Try clearing the date filter or checking back later.",
    },
    round_robin: {
      title: "No round robins available",
      description: "Nothing scheduled yet. Try viewing all events, or host your own.",
    },
    tournament: {
      title: "No tournaments listed",
      description: "Nothing on the schedule right now. Try viewing all events.",
    },
    open_play: {
      title: "No open play sessions",
      description: "Nothing scheduled. Try viewing all events.",
    },
    clinic: {
      title: "No clinics or lessons",
      description: "Nothing scheduled. Try viewing all events.",
    },
    league: {
      title: "No leagues running",
      description: "Try viewing all events.",
    },
    social: {
      title: "No socials scheduled",
      description: "Try viewing all events.",
    },
  };

  // Single search-bar block reused in both standalone and embedded modes —
  // previously this JSX was duplicated across two branches.
  const searchBar = (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
      <Input
        placeholder="Search events..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-9 h-10 input-premium text-sm"
      />
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-muted/50"
        onClick={() => setShowFilters(!showFilters)}
        aria-label={showFilters ? 'Hide filters' : 'Show filters'}
      >
        <Filter className={cn("w-4 h-4 transition-colors", showFilters && "text-primary")} />
      </Button>
    </div>
  );

  return (
    // Embedded mode (PlayHub) owns page-level chrome (min-h-screen, bg) —
    // applying it here would stack viewport-height containers.
    <div className={hideHeader ? undefined : "min-h-screen bg-background"}>
      {/* Refined Header - Premium Polish (suppressed in embedded mode) */}
      {!hideHeader ? (
        <div className="bg-gradient-to-b from-muted/20 to-background pt-4 pb-3 px-4 sm:px-6">
          <div className="max-w-3xl mx-auto">
            <h1 className="page-title">Find Events</h1>
            <p className="page-subtitle mt-0.5 mb-3">
              Round robins, open play, clinics, and more
            </p>
            {searchBar}
          </div>
        </div>
      ) : (
        <div className="px-4 sm:px-6 pt-3">
          <div className="max-w-3xl mx-auto">{searchBar}</div>
        </div>
      )}

      {/* Filters - Refined chips. Sticks below PlayerShell's global header
          (h-[64px] sm:h-[72px]) so it never slides under the nav bar. On the
          public /play route (no shell) there'll be a small gap above when
          scrolled — minor cosmetic tradeoff for correctness on /player/play. */}
      <div className="sticky top-16 sm:top-[72px] z-10 bg-background/95 backdrop-blur-sm border-b border-border/30">
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
        {/* Contextual intro — only renders when a specific type is selected */}
        <PlayContextBar eventType={eventType} />

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 rounded-xl border border-border/40 bg-card">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-5 h-5 text-destructive" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">Couldn't load events</h3>
            <p className="text-sm text-muted-foreground mb-4">Something went wrong. Try again in a moment.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </div>
        ) : filteredEvents.length === 0 ? (
          // Per-filter empty state — honest copy, helpful CTAs
          <div className="text-center py-12 sm:py-16 rounded-xl border border-border/40 bg-card">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-5 h-5 text-muted-foreground/70" />
            </div>
            <h3 className="text-base font-medium text-foreground mb-1">
              {searchQuery
                ? "No results"
                : emptyStateCopy[eventType].title}
            </h3>
            <p className="text-sm text-muted-foreground mb-5 max-w-xs mx-auto">
              {searchQuery
                ? `Nothing matched "${searchQuery}". Try a different search or clear filters.`
                : emptyStateCopy[eventType].description}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
              {searchQuery ? (
                <Button variant="outline" size="sm" onClick={() => setSearchQuery("")}>
                  Clear search
                </Button>
              ) : (
                // Empty-state primary action: clear the filter back to "All"
                // when a specific type returned nothing. The previous "Browse
                // venues" fallback was removed as part of the player-first
                // refocus (venue browsing isn't a player-side action now).
                eventType !== 'all' && (
                  <Button size="sm" onClick={() => setEventType('all')}>
                    View all events
                  </Button>
                )
              )}
            </div>
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
                    navigate(`/tournaments/${event.id}`);
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
