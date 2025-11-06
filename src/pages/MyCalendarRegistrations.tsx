import { PageHeader } from "@/components/PageHeader";
import { Calendar, Clock, MapPin, Users, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { EventModal } from "@/components/reservations/EventModal";

const EVENT_TYPE_LABELS = {
  league: "League",
  open_play: "Open Play",
  private: "Private",
  lesson: "Lesson",
};

const EVENT_TYPE_COLORS = {
  league: "bg-purple-100 text-purple-900",
  open_play: "bg-green-100 text-green-900",
  private: "bg-gray-100 text-gray-900",
  lesson: "bg-blue-100 text-blue-900",
};

export default function MyCalendarRegistrations() {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Fetch calendar event registrations
  const { data: calendarRegistrations = [] } = useQuery({
    queryKey: ["calendar-registrations", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("calendar_event_registrations")
        .select(`
          *,
          calendar_events (
            id,
            title,
            event_type,
            start_time,
            end_time,
            court_number,
            capacity,
            current_registrations,
            price,
            instructor,
            description,
            skill_level,
            facility_id
          )
        `)
        .eq("user_id", session.user.id)
        .eq("status", "confirmed")
        .order("calendar_events(start_time)", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!session?.user?.id,
  });

  // Fetch round robin registrations
  const { data: roundRobinRegistrations = [] } = useQuery({
    queryKey: ["rr-registrations", session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return [];

      const { data, error } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          event_id,
          registration_status,
          joined_at,
          event:round_robin_events(id, name, date, location, max_players, status)
        `)
        .eq("player_id", session.user.id)
        .eq("active", true);

      if (error) throw error;
      return (data || []).map((reg: any) => ({
        ...reg,
        type: 'round_robin',
        start_time: `${reg.event.date}T00:00:00`
      }));
    },
    enabled: !!session?.user?.id,
  });

  // Combine all registrations
  const allRegistrations = [
    ...calendarRegistrations.map((reg: any) => ({
      ...reg,
      type: 'calendar',
      start_time: reg.calendar_events?.start_time
    })),
    ...roundRobinRegistrations
  ];

  const filteredRegistrations = allRegistrations.filter((reg: any) => {
    const eventTime = reg.type === 'calendar' 
      ? (reg.calendar_events ? new Date(reg.calendar_events.start_time) : null)
      : new Date(reg.event.date);
    
    if (!eventTime) return false;
    return filter === "upcoming" ? !isPast(eventTime) : isPast(eventTime);
  });

  const handleCancelRegistration = async (registrationId: string, type: 'calendar' | 'round_robin') => {
    try {
      if (type === 'calendar') {
        const { error } = await supabase
          .from("calendar_event_registrations")
          .delete()
          .eq("id", registrationId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("round_robin_players")
          .update({ active: false })
          .eq("id", registrationId);

        if (error) throw error;
      }

      toast.success("Registration cancelled successfully");
      // Refetch would need to be handled differently now
      window.location.reload();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel registration");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={session?.user?.id} />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">My Registered Events</h1>
          </div>
          <p className="text-muted-foreground ml-11">
            All events, lessons, and court sessions you've signed up for
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            variant={filter === "upcoming" ? "default" : "outline"}
            onClick={() => setFilter("upcoming")}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Upcoming
          </Button>
          <Button
            variant={filter === "past" ? "default" : "outline"}
            onClick={() => setFilter("past")}
            className="gap-2"
          >
            <Filter className="w-4 h-4" />
            Past
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = "/browse-events"}
            className="gap-2 ml-auto"
          >
            <Calendar className="w-4 h-4" />
            Browse Events
          </Button>
        </div>

        {/* Registrations List */}
        {filteredRegistrations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No registrations found</h3>
              <p className="text-muted-foreground">
                {filter === "upcoming"
                  ? "You haven't registered for any upcoming events yet."
                  : "You don't have any past event registrations."}
              </p>
              <div className="flex gap-3 mt-4">
                <Button
                  onClick={() => window.location.href = "/browse-events"}
                >
                  Browse Events
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredRegistrations.map((reg: any) => {
              if (reg.type === 'round_robin') {
                const event = reg.event;
                const eventDate = new Date(event.date);
                const eventPassed = isPast(eventDate);

                return (
                  <Card key={reg.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 mb-2">
                            {event.name}
                            <Badge variant="outline">Round Robin</Badge>
                            <Badge variant={reg.registration_status === 'confirmed' ? 'default' : 'secondary'}>
                              {reg.registration_status.charAt(0).toUpperCase() + reg.registration_status.slice(1)}
                            </Badge>
                            {eventPassed && <Badge variant="secondary">Past</Badge>}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{format(eventDate, "EEEE, MMMM d, yyyy")}</span>
                        </div>

                        {event.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span>{event.location}</span>
                          </div>
                        )}

                        {event.max_players && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>Max Players: {event.max_players}</span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => window.location.href = `/round-robin/${event.id}`}
                          >
                            View Details
                          </Button>
                          {!eventPassed && reg.registration_status !== 'confirmed' && (
                            <Button
                              variant="destructive"
                              onClick={() => handleCancelRegistration(reg.id, 'round_robin')}
                            >
                              Cancel Registration
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                const event = reg.calendar_events;
                if (!event) return null;

                const startTime = new Date(event.start_time);
                const endTime = new Date(event.end_time);
                const eventPassed = isPast(startTime);

                return (
                  <Card key={reg.id} className="hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="flex items-center gap-2 mb-2">
                            {event.title}
                            <Badge className={EVENT_TYPE_COLORS[event.event_type as keyof typeof EVENT_TYPE_COLORS]}>
                              {EVENT_TYPE_LABELS[event.event_type as keyof typeof EVENT_TYPE_LABELS]}
                            </Badge>
                            {eventPassed && <Badge variant="secondary">Past</Badge>}
                          </CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>
                            Pickleball Citi, Cranston, RI - {event.court_number === 0 ? "Courts 1 & 2" : `Court ${event.court_number}`}
                          </span>
                        </div>

                        {event.capacity && (
                          <div className="flex items-center gap-2 text-sm">
                            <Users className="w-4 h-4 text-muted-foreground" />
                            <span>
                              {event.current_registrations || 0} / {event.capacity} registered
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            onClick={() => setSelectedEvent(event)}
                          >
                            View Details
                          </Button>
                          {!eventPassed && (
                            <Button
                              variant="destructive"
                              onClick={() => handleCancelRegistration(reg.id, 'calendar')}
                            >
                              Cancel Registration
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })}
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
