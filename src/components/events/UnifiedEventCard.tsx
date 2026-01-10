import { format } from "date-fns";
import { Calendar, MapPin, Users, Clock, Trophy, Gamepad2, GraduationCap, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DiscoverEvent } from "@/hooks/useDiscoverEvents";

interface UnifiedEventCardProps {
  event: DiscoverEvent;
  onClick?: () => void;
  compact?: boolean;
}

const eventTypeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  round_robin: { 
    icon: <Users className="w-3.5 h-3.5" />, 
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    label: "Round Robin"
  },
  tournament: { 
    icon: <Trophy className="w-3.5 h-3.5" />, 
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    label: "Tournament"
  },
  open_play: { 
    icon: <Gamepad2 className="w-3.5 h-3.5" />, 
    color: "bg-green-500/10 text-green-600 dark:text-green-400",
    label: "Open Play"
  },
  clinic: { 
    icon: <GraduationCap className="w-3.5 h-3.5" />, 
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    label: "Clinic"
  },
  league: { 
    icon: <Star className="w-3.5 h-3.5" />, 
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    label: "League"
  },
  social: { 
    icon: <Users className="w-3.5 h-3.5" />, 
    color: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    label: "Social"
  },
};

export function UnifiedEventCard({ event, onClick, compact = false }: UnifiedEventCardProps) {
  const typeConfig = eventTypeConfig[event.event_type] || eventTypeConfig.open_play;
  const eventDate = new Date(event.start_time);
  const isToday = new Date().toDateString() === eventDate.toDateString();
  const isTomorrow = new Date(Date.now() + 86400000).toDateString() === eventDate.toDateString();

  const dateLabel = isToday 
    ? "Today" 
    : isTomorrow 
      ? "Tomorrow" 
      : format(eventDate, "EEE, MMM d");

  const timeLabel = format(eventDate, "h:mm a");
  
  const locationLabel = [event.venue_name, event.venue_city]
    .filter(Boolean)
    .join(" • ");

  if (compact) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left p-3 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg", typeConfig.color)}>
            {typeConfig.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground text-sm truncate">{event.title}</p>
            <p className="text-xs text-muted-foreground">{dateLabel} • {timeLabel}</p>
          </div>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all group"
    >
      <div className="flex gap-4">
        {/* Date Column */}
        <div className="flex-shrink-0 w-14 text-center">
          <div className={cn(
            "rounded-lg p-2",
            isToday ? "bg-primary/10" : "bg-muted"
          )}>
            <p className={cn(
              "text-xs font-medium",
              isToday ? "text-primary" : "text-muted-foreground"
            )}>
              {format(eventDate, "MMM")}
            </p>
            <p className={cn(
              "text-xl font-bold",
              isToday ? "text-primary" : "text-foreground"
            )}>
              {format(eventDate, "d")}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Type Badge */}
          <div className="flex items-center gap-2 mb-1.5">
            <Badge variant="secondary" className={cn("text-xs px-2 py-0.5", typeConfig.color)}>
              <span className="mr-1">{typeConfig.icon}</span>
              {typeConfig.label}
            </Badge>
            {event.is_full && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 text-destructive border-destructive/30">
                Full
              </Badge>
            )}
          </div>

          {/* Title */}
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 line-clamp-1">
            {event.title}
          </h3>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {timeLabel}
            </span>
            {locationLabel && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {locationLabel}
              </span>
            )}
            {event.max_participants && (
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                {event.spots_left !== null ? (
                  event.spots_left > 0 
                    ? `${event.spots_left} spot${event.spots_left !== 1 ? 's' : ''} left`
                    : "Waitlist"
                ) : (
                  `${event.current_participants || 0}/${event.max_participants}`
                )}
              </span>
            )}
          </div>

          {/* Skill Level */}
          {(event.skill_level_min || event.skill_level_max) && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                Skill: {event.skill_level_min?.toFixed(1) || "Any"} - {event.skill_level_max?.toFixed(1) || "Any"}
              </Badge>
            </div>
          )}

          {/* Price */}
          {event.price !== null && Number(event.price) > 0 && (
            <p className="mt-2 text-sm font-medium text-foreground">
              ${Number(event.price).toFixed(0)}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
