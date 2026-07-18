import { PageHeader } from "@/components/PageHeader";
import { Calendar, Clock, MapPin, Users, Filter, CalendarPlus, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, isPast, parseISO } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";
import { EventModal } from "@/components/reservations/EventModal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

const EVENT_TYPE_LABELS = {
  league: "League",
  open_play: "Open Play",
  private: "Private",
  lesson: "Lesson",
};

const EVENT_TYPE_COLORS = {
  league: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  open_play: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  private: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
  lesson: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
};

const STATUS_COLORS = {
  confirmed: "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800",
  waitlisted: "bg-orange-50 text-orange-800 dark:bg-orange-950/30 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  cancelled: "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-300 border-red-200 dark:border-red-800",
};

export default function MyCalendarRegistrations() {
  const [filter, setFilter] = useState<"upcoming" | "past">("upcoming");
  const [sortBy, setSortBy] = useState<"date" | "type">("date");
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
          event:round_robin_events(id, name, date, start_time, location, max_players, status, organizer_id, registration_deadline)
        `)
        .eq("player_id", session.user.id)
        .eq("active", true);

      if (error) throw error;

      // Enrich with current player counts
      const enrichedData = await Promise.all((data || []).map(async (reg: any) => {
        const { data: players, error: countError } = await supabase
          .from("round_robin_players")
          .select("id")
          .eq("event_id", reg.event_id)
          .eq("active", true)
          .eq("registration_status", "confirmed");

        if (countError) {
          console.error("Error counting players:", countError);
        }

        return {
          ...reg,
          type: 'round_robin',
          event_start_time: reg.event.date,
          current_players: players?.length || 0
        };
      }));

      return enrichedData;
    },
    enabled: !!session?.user?.id,
  });

  // Combine all registrations
  const allRegistrations = [
    ...calendarRegistrations.map((reg: any) => ({
      ...reg,
      type: 'calendar',
      event_start_time: reg.calendar_events?.start_time
    })),
    ...roundRobinRegistrations
  ].sort((a, b) => {
    const timeA = a.type === 'calendar' ? new Date(a.event_start_time || 0) : parseISO((a.event_start_time || '') + 'T00:00:00');
    const timeB = b.type === 'calendar' ? new Date(b.event_start_time || 0) : parseISO((b.event_start_time || '') + 'T00:00:00');
    return timeA.getTime() - timeB.getTime();
  });

  const filteredRegistrations = allRegistrations.filter((reg: any) => {
    const eventTime = reg.type === 'calendar' 
      ? (reg.calendar_events ? new Date(reg.calendar_events.start_time) : null)
      : parseISO((reg.event?.date || reg.event_start_time) + 'T00:00:00');
    
    if (!eventTime) return false;
    
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today
    
    return filter === "upcoming" ? eventTime >= now : eventTime < now;
  });

  const handleCancelRegistration = async (registrationId: string, type: 'calendar' | 'round_robin') => {
    try {
      if (type === 'calendar') {
        if (!confirm('Are you sure you want to cancel this registration?')) return;

        const { error } = await supabase
          .from("calendar_event_registrations")
          .delete()
          .eq("id", registrationId);

        if (error) throw error;
        toast.success('Registration cancelled');
      } else {
        // For round robin, validate before allowing leave
        const registration = roundRobinRegistrations.find((r: any) => r.id === registrationId);
        if (!registration) return;

        const eventData = registration.event;

        // Validation checks
        if (eventData.organizer_id === session?.user?.id) {
          toast.error("Organizers cannot leave their own events");
          return;
        }

        if (eventData.status === 'live' || eventData.status === 'completed') {
          toast.error("Cannot leave event that has already started");
          return;
        }

        if (eventData.registration_deadline && new Date() > new Date(eventData.registration_deadline)) {
          toast.error("Registration deadline has passed");
          return;
        }

        if (!confirm(`Are you sure you want to leave "${eventData.name}"? You can rejoin before the registration deadline.`)) return;

        const { error } = await supabase
          .from("round_robin_players")
          .update({ active: false })
          .eq("id", registrationId);

        if (error) throw error;
        toast.success('You have left the event');
      }

      window.location.reload();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel registration");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={session?.user?.id} />

      {/* Refined Header Section */}
      <div className="border-b border-border/50 bg-muted/30">
        <div className="container mx-auto py-6 px-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Title & Subtitle */}
            <div>
              <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                My Registered Events
              </h1>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                All events, lessons, and court sessions you've signed up for
              </p>
            </div>

            {/* Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filter === "upcoming" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("upcoming")}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Upcoming
              </Button>
              <Button
                variant={filter === "past" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("past")}
                className="gap-2"
              >
                <Filter className="w-4 h-4" />
                Past
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = "/events/browse"}
                className="gap-2"
              >
                <CalendarPlus className="w-4 h-4" />
                Browse Events
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6">
        <div className="container mx-auto px-4">

        {/* Sort */}
        <div className="flex justify-end mb-6">
          <Select value={sortBy} onValueChange={(value: "date" | "type") => setSortBy(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">Sort by Date</SelectItem>
              <SelectItem value="type">Sort by Type</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Registrations List */}
        {filteredRegistrations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-base font-medium mb-2">No registrations found</h3>
              <p className="text-sm text-muted-foreground font-normal">
                {filter === "upcoming"
                  ? "You haven't registered for any upcoming events yet."
                  : "You don't have any past event registrations."}
              </p>
              <div className="flex justify-center gap-3 mt-4">
                <Button
                  onClick={() => window.location.href = "/events/browse"}
                >
                  Browse Events
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 max-w-5xl mx-auto">
            {filteredRegistrations.map((reg: any) => {
              if (reg.type === 'round_robin') {
                const event = reg.event;
                const eventDate = parseISO(event.date + 'T00:00:00');
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const eventPassed = eventDate < now;

                return (
                  <Card key={reg.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Trophy className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="flex items-start gap-2 mb-2 flex-wrap">
                              <span className="break-words">{event.name}</span>
                            </CardTitle>
                            <div className="flex gap-2 flex-wrap">
                              <Badge variant="outline" className="border">Round Robin</Badge>
                              <Badge className={STATUS_COLORS[reg.registration_status as keyof typeof STATUS_COLORS] || STATUS_COLORS.confirmed}>
                                {reg.registration_status.charAt(0).toUpperCase() + reg.registration_status.slice(1)}
                              </Badge>
                              {eventPassed && <Badge variant="secondary" className="bg-muted">Past</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">{format(eventDate, "EEEE, MMMM d, yyyy")}</span>
                        </div>

                        {event.start_time && (
                          <div className="flex items-center gap-2 text-sm text-primary">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">{format(parseISO(event.date + 'T' + event.start_time), "h:mm a")}</span>
                          </div>
                        )}

                        {event.location && (
                          <div className="flex items-center gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <span>{event.location}</span>
                          </div>
                        )}

                        {event.max_players && (
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Players</span>
                              </div>
                              <span className="font-medium">
                                {reg.current_players || 0} / {event.max_players}
                              </span>
                            </div>
                            <Progress value={((reg.current_players || 0) / event.max_players) * 100} className="h-2" />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => window.location.href = `/round-robin/${event.id}`}
                        >
                          View Details
                        </Button>
                        {!eventPassed && event.status === 'draft' && (
                          <Button
                            variant="destructive"
                            className="flex-1 hover:bg-destructive/90 transition-colors"
                            onClick={() => handleCancelRegistration(reg.id, 'round_robin')}
                          >
                            Leave Event
                          </Button>
                        )}
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
                  <Card key={reg.id} className="hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-border/50">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Calendar className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="flex items-start gap-2 mb-2 flex-wrap">
                              <span className="break-words">{event.title}</span>
                            </CardTitle>
                            <div className="flex gap-2 flex-wrap">
                              <Badge className={`border ${EVENT_TYPE_COLORS[event.event_type as keyof typeof EVENT_TYPE_COLORS]}`}>
                                {EVENT_TYPE_LABELS[event.event_type as keyof typeof EVENT_TYPE_LABELS]}
                              </Badge>
                              {eventPassed && <Badge variant="secondary" className="bg-muted">Past</Badge>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Calendar className="w-4 h-4" />
                          <span className="font-medium">{format(startTime, "EEEE, MMMM d, yyyy")}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-primary">
                          <Clock className="w-4 h-4" />
                          <span className="font-medium">
                            {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-sm sm:col-span-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span>
                            Pickleball Citi, Cranston, RI - {event.court_number === 0 ? "Courts 1 & 2" : `Court ${event.court_number}`}
                          </span>
                        </div>

                        {event.capacity && (
                          <div className="sm:col-span-2">
                            <div className="flex items-center justify-between text-sm mb-1.5">
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Registration</span>
                              </div>
                              <span className="font-medium">
                                {event.current_registrations || 0} / {event.capacity}
                              </span>
                            </div>
                            <Progress value={((event.current_registrations || 0) / event.capacity) * 100} className="h-2" />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 pt-3 border-t">
                        <Button
                          variant="outline"
                          className="flex-1 gap-2"
                          onClick={() => setSelectedEvent(event)}
                        >
                          View Details
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="gap-2"
                          title="Add to Calendar"
                        >
                          <CalendarPlus className="w-4 h-4" />
                        </Button>
                        {!eventPassed && (
                          <Button
                            variant="destructive"
                            className="flex-1 hover:bg-destructive/90 transition-colors"
                            onClick={() => handleCancelRegistration(reg.id, 'calendar')}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })}
          </div>
        )}
        </div>
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
