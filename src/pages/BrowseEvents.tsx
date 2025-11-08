import { PageHeader } from "@/components/PageHeader";
import { Calendar, MapPin, Search, Users, Clock, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarEventTile } from "@/components/reservations/CalendarEventTile";
import { EventModal } from "@/components/reservations/EventModal";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

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

interface RoundRobinEventEnriched {
  id: string;
  name: string;
  date: string;
  start_time?: string;
  location: string;
  max_players: number;
  registration_deadline: string;
  rating_eligible: boolean;
  rating_type: string;
  confirmed_count: number;
  waitlisted_count: number;
  is_registered: boolean;
  my_status?: string;
  organizer_name: string;
}

export default function BrowseEvents() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [joiningRREvent, setJoiningRREvent] = useState<string | null>(null);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const userId = session?.user?.id || null;

  // Fetch round robin events
  const { data: roundRobinEvents = [], isLoading: rrLoading, refetch: refetchRR } = useQuery({
    queryKey: ["browse-round-robin-events", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("is_published", true)
        .eq("registration_mode", "open_registration")
        .gte("registration_deadline", new Date().toISOString())
        .order("date", { ascending: true });

      if (error) throw error;

      const enrichedEvents: RoundRobinEventEnriched[] = await Promise.all(
        (data || []).map(async (event) => {
          const { data: players } = await supabase
            .from("round_robin_players")
            .select("registration_status")
            .eq("event_id", event.id)
            .eq("active", true);

          const confirmed = players?.filter(p => p.registration_status === "confirmed").length || 0;
          const waitlisted = players?.filter(p => p.registration_status === "waitlisted").length || 0;

          let myReg = null;
          if (userId) {
            const { data } = await supabase
              .from("round_robin_players")
              .select("registration_status")
              .eq("event_id", event.id)
              .eq("player_id", userId)
              .eq("active", true)
              .maybeSingle();
            myReg = data;
          }

          const { data: organizer } = await supabase
            .from("profiles")
            .select("full_name, display_name")
            .eq("id", event.organizer_id)
            .single();

          return {
            id: event.id,
            name: event.name,
            date: event.date,
            start_time: event.start_time,
            location: event.location,
            max_players: event.max_players,
            registration_deadline: event.registration_deadline,
            rating_eligible: event.rating_eligible,
            rating_type: event.rating_type,
            confirmed_count: confirmed,
            waitlisted_count: waitlisted,
            is_registered: !!myReg,
            my_status: myReg?.registration_status,
            organizer_name: organizer?.display_name || organizer?.full_name || "Organizer"
          };
        })
      );

      return enrichedEvents;
    },
  });

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["browse-calendar-events"],
    queryFn: async () => {
      const { data: calendarEvents, error: eventsError } = await supabase
        .from("calendar_events")
        .select("*")
        .gte("start_time", new Date().toISOString())
        .neq("event_type", "private")
        .order("start_time", { ascending: true });

      if (eventsError) throw eventsError;

      const { data: courts, error: courtsError } = await supabase
        .from("courts")
        .select("id, name, location, city, state");

      if (courtsError) throw courtsError;

      const courtsMap = new Map(courts?.map((c) => [c.name.toLowerCase(), c]) || []);
      
      const eventsWithCourts = (calendarEvents || []).map((event) => {
        let court = courtsMap.get(event.facility_id?.toLowerCase()) || 
                    courtsMap.get("pickleball citi");
        
        return {
          ...event,
          courts: court || { name: "Pickleball Citi", location: "Cranston", city: "Cranston", state: "RI" },
        };
      }) as CalendarEventWithCourt[];

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

  // Group calendar events by court
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

  // Group round robin events by location
  const rrEventsByLocation = roundRobinEvents.reduce((acc, event) => {
    const location = event.location;
    if (!acc[location]) {
      acc[location] = [];
    }
    acc[location].push(event);
    return acc;
  }, {} as Record<string, RoundRobinEventEnriched[]>);

  // Filter calendar events
  const filteredCourtGroups = Object.entries(eventsByCourt)
    .filter(([courtName, group]) => {
      // Skip if filtering for round robin only
      if (eventTypeFilter === "round_robin") return false;
      
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

  // Filter round robin events
  const filteredRRGroups = Object.entries(rrEventsByLocation)
    .map(([location, events]) => ({
      location,
      events: events.filter(event => {
        const matchesSearch = searchTerm === "" ||
          event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          location.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesType = eventTypeFilter === "all" || eventTypeFilter === "round_robin";
        
        return matchesSearch && matchesType;
      })
    }))
    .filter(group => group.events.length > 0)
    .sort((a, b) => a.location.localeCompare(b.location));

  const handleJoinRREvent = async (eventId: string, maxPlayers: number, confirmedCount: number) => {
    if (!userId) {
      toast.error("Please sign in to join events");
      navigate("/auth");
      return;
    }

    setJoiningRREvent(eventId);
    try {
      const status = confirmedCount >= maxPlayers ? "waitlisted" : "confirmed";
      
      const { error } = await supabase
        .from("round_robin_players")
        .insert({
          event_id: eventId,
          player_id: userId,
          registration_status: status,
          active: true
        });

      if (error) throw error;

      toast.success(
        status === "confirmed" 
          ? "Successfully registered!" 
          : "Added to waitlist - you'll be notified if a spot opens"
      );
      refetchRR();
    } catch (error: any) {
      console.error("Join error:", error);
      if (error.code === "23505") {
        toast.error("You're already registered for this event");
      } else {
        toast.error("Failed to join event");
      }
    } finally {
      setJoiningRREvent(null);
    }
  };

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
            <Button
              variant={eventTypeFilter === "round_robin" ? "default" : "outline"}
              size="sm"
              onClick={() => setEventTypeFilter("round_robin")}
            >
              Round Robin
            </Button>
          </div>
        </div>

        {isLoading || rrLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading events...</p>
          </div>
        ) : filteredCourtGroups.length === 0 && filteredRRGroups.length === 0 ? (
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
            {/* Calendar Events */}
            {filteredCourtGroups.map((group) => (
              <div key={group.courtName}>
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

            {/* Round Robin Events */}
            {filteredRRGroups.map(({ location, events }) => (
              <div key={location}>
                <Card className="mb-4 bg-muted/30">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Trophy className="w-5 h-5" style={{ color: "#A9DC3D" }} />
                      <div>
                        <div className="text-xl">{location}</div>
                        <div className="text-sm font-normal text-muted-foreground mt-1">
                          Round Robin Events
                        </div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {events.map((event, index) => {
                    const eventDate = parseISO(event.date + 'T00:00:00');
                    const deadline = parseISO(event.registration_deadline);
                    const isFull = event.confirmed_count >= event.max_players;

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.1 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                      >
                        <Card className="cursor-pointer rounded-2xl border-2 border-border shadow-lg hover:shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(169,220,61,0.15)] transition-all duration-300 h-full bg-card">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <CardTitle className="text-xl line-clamp-1">{event.name}</CardTitle>
                              {event.is_registered ? (
                                <Badge variant={event.my_status === "confirmed" ? "default" : "secondary"}>
                                  {event.my_status === "confirmed" ? "Registered" : "Waitlisted"}
                                </Badge>
                              ) : (
                                <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                                  Round Robin
                                </Badge>
                              )}
                            </div>
                            <CardDescription className="text-sm">
                              Organized by {event.organizer_name}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar className="w-4 h-4" />
                              <span>{format(eventDate, "MMM d, yyyy")}</span>
                            </div>
                            {event.start_time && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="w-4 h-4" />
                                <span>{event.start_time}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>Register by {format(deadline, "MMM d, h:mm a")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="w-4 h-4" />
                              <span>
                                {event.confirmed_count}/{event.max_players} spots
                                {event.waitlisted_count > 0 && (
                                  <span className="ml-1">(+{event.waitlisted_count} waitlist)</span>
                                )}
                              </span>
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => navigate(`/round-robin/${event.id}`)}
                              >
                                View Details
                              </Button>
                              {!event.is_registered && (
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => handleJoinRREvent(event.id, event.max_players, event.confirmed_count)}
                                  disabled={joiningRREvent === event.id}
                                  style={{
                                    backgroundColor: "#B9E43B",
                                    color: "#0E4C58",
                                  }}
                                >
                                  {joiningRREvent === event.id 
                                    ? "Joining..." 
                                    : isFull ? "Join Waitlist" : "Join Event"
                                  }
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
