import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar, Clock, Users, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface JoinableCalendarEventsProps {
  courtId: string;
}

export function JoinableCalendarEvents({ courtId }: JoinableCalendarEventsProps) {
  const navigate = useNavigate();

  const { data: events = [] } = useQuery({
    queryKey: ["joinable-calendar-events", courtId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .neq("event_type", "private")
        .gte("start_time", now)
        .order("start_time", { ascending: true })
        .limit(6);
      
      if (error) throw error;
      return data || [];
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

  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No upcoming events available at this time. Check back soon!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Upcoming Events
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/reservations')}
          >
            View All
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-base line-clamp-1">{event.title}</h3>
                    <Badge className={getEventColor(event.event_type)}>
                      {getEventTypeLabel(event.event_type)}
                    </Badge>
                  </div>

                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  )}

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{format(new Date(event.start_time), "MMM d, yyyy")}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>
                        {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>Court {event.court_number}</span>
                    </div>
                    {event.capacity && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>
                          {event.current_registrations}/{event.capacity} registered
                        </span>
                      </div>
                    )}
                    {event.skill_level && event.skill_level !== "all" && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {event.skill_level}
                        </Badge>
                      </div>
                    )}
                    {event.price > 0 && (
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        ${event.price.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
