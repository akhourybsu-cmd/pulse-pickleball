import { useNavigate } from "react-router-dom";
import { Calendar, ChevronRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingRegisteredEvents } from "@/hooks/useDiscoverEvents";
import { cn } from "@/lib/utils";

interface UpcomingEventsPreviewProps {
  userId: string | undefined;
}

export function UpcomingEventsPreview({ userId }: UpcomingEventsPreviewProps) {
  const navigate = useNavigate();
  const { data: registrations, isLoading } = useUpcomingRegisteredEvents(userId, 3);

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const hasEvents = registrations && registrations.length > 0;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          Upcoming play
        </h3>
        {hasEvents && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground h-auto p-0"
            onClick={() => navigate("/player/my-events")}
          >
            View All
            <ChevronRight className="w-3 h-3 ml-1" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {hasEvents ? (
          <div className="space-y-2">
            {registrations.map((registration: any) => {
              const event = registration.event;
              if (!event) return null;
              
              const eventDate = new Date(event.start_time);
              const isToday = new Date().toDateString() === eventDate.toDateString();

              return (
                <button
                  key={registration.id}
                  onClick={() => {
                    if (event.event_type === 'round_robin') {
                      navigate(`/round-robin/${event.id}`);
                    } else if (event.event_type === 'tournament') {
                      navigate(`/tournaments/${event.id}`);
                    } else {
                      navigate(`/events/${event.id}`);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  {/* Date Badge */}
                  <div className={cn(
                    "flex-shrink-0 w-11 h-11 rounded-lg flex flex-col items-center justify-center",
                    isToday ? "bg-primary text-primary-foreground" : "bg-background border border-border"
                  )}>
                    <span className="text-[10px] font-medium uppercase">
                      {format(eventDate, "MMM")}
                    </span>
                    <span className="text-base font-bold leading-none">
                      {format(eventDate, "d")}
                    </span>
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      {format(eventDate, "h:mm a")}
                      {registration.venue_name && (
                        <>
                          <span className="mx-1">•</span>
                          <MapPin className="w-3 h-3" />
                          {registration.venue_name}
                        </>
                      )}
                    </p>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              No upcoming events
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/player/play")}
              className="h-8 text-xs"
            >
              Find something to play
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
