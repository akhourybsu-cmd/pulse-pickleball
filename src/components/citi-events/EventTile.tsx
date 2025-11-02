import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  max_players: number;
  skill_tag: string | null;
  price_label: string | null;
  is_published: boolean;
  attendee_count: number;
  waitlist_count: number;
  user_status: "none" | "attending" | "waitlisted" | "checked_in";
  is_full: boolean;
}

interface EventTileProps {
  event: Event;
  isAdmin: boolean;
  onJoin: (eventId: string) => void;
  onLeave: (eventId: string) => void;
  onJoinWaitlist: (eventId: string) => void;
  onClick: (eventId: string) => void;
}

export function EventTile({
  event,
  isAdmin,
  onJoin,
  onLeave,
  onJoinWaitlist,
  onClick,
}: EventTileProps) {
  const formatEventDate = () => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const dateStr = format(start, "EEE MMM d");
    const timeStr = `${format(start, "h:mm a")}–${format(end, "h:mm a")}`;
    return { dateStr, timeStr };
  };

  const { dateStr, timeStr } = formatEventDate();

  const getButtonLabel = () => {
    if (isAdmin) return "Manage";
    if (event.user_status === "attending" || event.user_status === "checked_in")
      return "Going ✓";
    if (event.user_status === "waitlisted") return "Waitlisted";
    if (event.is_full) return "Waitlist";
    return "Join";
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAdmin) {
      onClick(event.id);
      return;
    }
    if (
      event.user_status === "attending" ||
      event.user_status === "checked_in" ||
      event.user_status === "waitlisted"
    ) {
      onLeave(event.id);
    } else if (event.is_full) {
      onJoinWaitlist(event.id);
    } else {
      onJoin(event.id);
    }
  };

  return (
    <Card
      className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-pointer transition-all hover:shadow-lg group"
      onClick={() => onClick(event.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg leading-tight flex-1 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary/90 group-hover:to-primary/60 transition-all">
            {event.title}
          </h3>
          {!event.is_published && (
            <Badge
              variant="outline"
              className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-400 dark:border-yellow-800 flex-shrink-0"
            >
              Draft
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{timeStr}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 flex-shrink-0" />
            <span>
              {event.attendee_count} / {event.max_players} spots
              {event.is_full && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  · Full
                </span>
              )}
            </span>
          </div>
          {event.waitlist_count > 0 && (
            <div className="text-xs pl-6">
              Waitlist: {event.waitlist_count}
            </div>
          )}
        </div>

        {(event.skill_tag || event.price_label) && (
          <div className="flex items-center gap-2 flex-wrap">
            {event.skill_tag && (
              <Badge variant="outline" className="text-xs">
                {event.skill_tag}
              </Badge>
            )}
            {event.price_label && (
              <Badge variant="outline" className="text-xs">
                {event.price_label}
              </Badge>
            )}
          </div>
        )}

        <Button
          onClick={handleButtonClick}
          className="w-full"
          size="sm"
          variant={
            event.user_status === "attending" ||
            event.user_status === "checked_in"
              ? "outline"
              : "default"
          }
        >
          {getButtonLabel()}
        </Button>
      </CardContent>
    </Card>
  );
}
