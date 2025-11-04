import { PageHeader } from "@/components/PageHeader";
import { Calendar, MapPin, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarEventTile } from "@/components/reservations/CalendarEventTile";
import { EventModal } from "@/components/reservations/EventModal";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface CalendarEventWithCourt {
  id: string;
  title: string;
  event_type: string;
  start_time: string;
  end_time: string;
  court_number: number;
  capacity: number;
  current_registrations: number;
  price: number;
  instructor: string | null;
  description: string | null;
  skill_level: string | null;
  facility_id: string;
  series_id: string | null;
  courts: {
    id: string;
    name: string;
    location: string;
    city: string;
    state: string;
  } | null;
}

export default function BrowseEvents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["browse-calendar-events"],
    queryFn: async () => {
      const { data: calendarEvents, error: eventsError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", new Date().toISOString())
        .neq("event_type", "private_rental")
        .order("start_time", { ascending: true });

      if (eventsError) throw eventsError;

      // Fetch all courts
      const { data: courts, error: courtsError } = await supabase
        .from("courts")
        .select("id, name, location, city, state");

      if (courtsError) throw courtsError;

      // Map events with their courts
      const courtsMap = new Map(courts?.map((c) => [c.id, c]) || []);
      
      const eventsWithCourts = (calendarEvents || []).map((event) => ({
        ...event,
        courts: courtsMap.get(event.facility_id) || null,
      })) as CalendarEventWithCourt[];

      // Group league events by series_id, only show first instance
      const leagueSeriesMap = new Map<string, CalendarEventWithCourt>();
      const nonLeagueEvents: CalendarEventWithCourt[] = [];

      eventsWithCourts.forEach((event) => {
        if (event.event_type === "league" && event.series_id) {
          if (!leagueSeriesMap.has(event.series_id)) {
            leagueSeriesMap.set(event.series_id, event);
          }
        } else {
          nonLeagueEvents.push(event);
        }
      });

      return [...Array.from(leagueSeriesMap.values()), ...nonLeagueEvents].sort(
        (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
    },
  });

  // Group events by court
  const eventsByCourt = events.reduce((acc, event) => {
    const courtName = event.courts?.name || "Unknown Court";
    if (!acc[courtName]) {
      acc[courtName] = {
        court: event.courts,
        events: [],
      };
    }
    acc[courtName].events.push(event);
    return acc;
  }, {} as Record<string, { court: any; events: CalendarEventWithCourt[] }>);

  // Filter by search term and event type
  const filteredCourtGroups = Object.entries(eventsByCourt)
    .filter(([courtName, group]) => {
      // Filter by event type first
      const typeFilteredEvents = group.events.filter((event) => {
        if (eventTypeFilter === "all") return true;
        return event.event_type === eventTypeFilter;
      });

      if (typeFilteredEvents.length === 0) return false;

      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        courtName.toLowerCase().includes(searchLower) ||
        typeFilteredEvents.some(
          (event) =>
            event.title.toLowerCase().includes(searchLower) ||
            event.event_type.toLowerCase().includes(searchLower)
        )
      );
    })
    .map(([courtName, group]) => ({
      courtName,
      ...group,
      events: group.events.filter((event) => {
        if (eventTypeFilter === "all") return true;
        return event.event_type === eventTypeFilter;
      }),
    }));

  const handleRegister = async (eventId: string) => {
    if (!session?.user?.id) {
      toast.error("Please log in to register for events");
      return;
    }

    try {
      const { error } = await supabase
        .from("calendar_event_registrations")
        .insert({
          event_id: eventId,
          user_id: session.user.id,
          status: "confirmed",
        });

      if (error) throw error;

      toast.success("Successfully registered for event!");
      refetch();
    } catch (error: any) {
      console.error("Registration error:", error);
      if (error.code === "23505") {
        toast.error("You're already registered for this event");
      } else {
        toast.error("Failed to register for event");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={session?.user?.id} />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">Browse All Events</h1>
          </div>
          <p className="text-muted-foreground ml-11">
            Discover upcoming events, lessons, and sessions across all courts
          </p>
        </div>

        {/* Search Bar and Filters */}
        <div className="mb-6 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="text"
              placeholder="Search by court, event name, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {/* Event Type Filters */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={eventTypeFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setEventTypeFilter("all")}
            >
              All Events
            </Button>
            <Button
              variant={eventTypeFilter === "open_play" ? "default" : "outline"}
              size="sm"
              onClick={() => setEventTypeFilter("open_play")}
            >
              Open Play
            </Button>
            <Button
              variant={eventTypeFilter === "league" ? "default" : "outline"}
              size="sm"
              onClick={() => setEventTypeFilter("league")}
            >
              League
            </Button>
            <Button
              variant={eventTypeFilter === "lesson" ? "default" : "outline"}
              size="sm"
              onClick={() => setEventTypeFilter("lesson")}
            >
              Lesson
            </Button>
          </div>
        </div>

        {/* Events grouped by court */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading events...</p>
          </div>
        ) : filteredCourtGroups.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No events found</h3>
              <p className="text-muted-foreground">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "No upcoming events available at this time"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {filteredCourtGroups.map((group) => (
              <div key={group.courtName}>
                {/* Court Header */}
                <Card className="mb-4 bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-primary" />
                      <div>
                        <div className="text-xl">{group.courtName}</div>
                        {group.court && (
                          <div className="text-sm font-normal text-muted-foreground mt-1">
                            {group.court.location}, {group.court.city},{" "}
                            {group.court.state}
                          </div>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                </Card>

                {/* Event Tiles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {group.events.map((event) => (
                    <CalendarEventTile
                      key={event.id}
                      event={event}
                      currentUserId={session?.user?.id || null}
                      onRegister={handleRegister}
                      onClick={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        currentUserId={session?.user?.id || null}
        isAdmin={false}
      />
    </div>
  );
}
