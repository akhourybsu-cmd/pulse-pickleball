import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Calendar, Clock, Users, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

interface JoinableCalendarEventsProps {
  courtId: string;
  vertical?: boolean;
}

interface GroupedEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_time: string;
  end_time: string;
  courts: number[];
  capacity: number | null;
  current_registrations: number;
  price: number;
  instructor: string | null;
  skill_level: string | null;
}

export function JoinableCalendarEvents({ courtId, vertical = false }: JoinableCalendarEventsProps) {
  const { data: events = [] } = useQuery({
    queryKey: ["joinable-calendar-events", courtId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .neq("event_type", "private")
        .gte("start_time", now)
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      
      // Group events by title, start_time, end_time, and event_type
      const eventMap = new Map<string, GroupedEvent>();
      
      (data || []).forEach((event) => {
        const key = `${event.title}-${event.start_time}-${event.end_time}-${event.event_type}`;
        
        if (eventMap.has(key)) {
          const existing = eventMap.get(key)!;
          existing.courts.push(event.court_number);
          existing.courts.sort((a, b) => a - b);
          // Aggregate capacity and registrations
          if (event.capacity) {
            existing.capacity = (existing.capacity || 0) + event.capacity;
          }
          existing.current_registrations += event.current_registrations || 0;
        } else {
          eventMap.set(key, {
            id: event.id,
            title: event.title,
            description: event.description,
            event_type: event.event_type,
            start_time: event.start_time,
            end_time: event.end_time,
            courts: [event.court_number],
            capacity: event.capacity,
            current_registrations: event.current_registrations || 0,
            price: event.price || 0,
            instructor: event.instructor,
            skill_level: event.skill_level,
          });
        }
      });
      
      // Convert to array and take first 3
      return Array.from(eventMap.values()).slice(0, 3);
    },
  });

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "league":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "open_play":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "lesson":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    switch (eventType) {
      case "league":
        return "League";
      case "open_play":
        return "Open Play";
      case "lesson":
        return "Lesson";
      default:
        return eventType;
    }
  };

  const formatCourts = (courts: number[]) => {
    if (courts.length === 1) {
      return `Court ${courts[0]}`;
    }
    return `Courts ${courts.join(", ")}`;
  };

  if (vertical) {
    return (
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Calendar className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No events scheduled yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an event or check back soon to see what's happening.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <motion.div
                key={`${event.title}-${event.start_time}-${index}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <CardTitle className="text-base sm:text-lg line-clamp-2">{event.title}</CardTitle>
                        {event.description && (
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                      </div>
                      <Badge className={getEventColor(event.event_type)}>
                        {getEventTypeLabel(event.event_type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{format(new Date(event.start_time), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs sm:text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span>
                        {format(new Date(event.start_time), 'h:mm a')} - {format(new Date(event.end_time), 'h:mm a')}
                      </span>
                    </div>
                    {event.courts.length > 0 && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{formatCourts(event.courts)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-xs sm:text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{event.current_registrations} / {event.capacity || 0}</span>
                      </div>
                      {event.price && event.price > 0 && (
                        <Badge variant="secondary">${Number(event.price).toFixed(2)}</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#0E4C58' }}>
          <Calendar className="w-6 h-6" style={{ color: '#A9DC3D' }} />
          Upcoming Events
        </h2>
        <Button
          variant="outline"
          size="sm"
          asChild
        >
          <Link to={`/browse-events?court=${courtId}`}>
            View All
          </Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, index) => (
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
                  <CardTitle className="text-xl line-clamp-1">{event.title}</CardTitle>
                  <Badge className={getEventColor(event.event_type)}>
                    {getEventTypeLabel(event.event_type)}
                  </Badge>
                </div>
                {event.description && (
                  <CardDescription className="line-clamp-2 text-sm">
                    {event.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(event.start_time), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>
                    {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{formatCourts(event.courts)}</span>
                </div>
                {event.capacity && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      {event.current_registrations}/{event.capacity} spots
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  {event.skill_level && event.skill_level !== "all" && (
                    <Badge variant="outline" className="capitalize text-xs">
                      {event.skill_level}
                    </Badge>
                  )}
                  {event.price > 0 && (
                    <span className="font-semibold text-sm" style={{ color: '#A9DC3D' }}>
                      ${event.price.toFixed(2)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
