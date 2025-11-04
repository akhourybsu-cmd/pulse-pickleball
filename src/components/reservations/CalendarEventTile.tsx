import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Clock, DollarSign, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo-2.png";

const EVENT_TYPE_LABELS = {
  league: "League",
  open_play: "Open Play",
  private: "Private",
  lesson: "Lesson",
};

const EVENT_TYPE_COLORS = {
  league: "bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100",
  open_play: "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100",
  private: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
  lesson: "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100",
};

interface CalendarEventTileProps {
  event: {
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
    skill_level: string | null;
    facility_id?: string;
    courts?: {
      name: string;
      location?: string;
      city?: string;
      state?: string;
    } | null;
  };
  currentUserId: string | null;
  onRegister: (eventId: string) => void;
  onClick: (eventId: string) => void;
}

export function CalendarEventTile({
  event,
  currentUserId,
  onRegister,
  onClick,
}: CalendarEventTileProps) {
  const { data: isRegistered = false } = useQuery({
    queryKey: ["event-registration-status", event.id, currentUserId],
    queryFn: async () => {
      if (!currentUserId) return false;

      const { data, error } = await supabase
        .from("calendar_event_registrations")
        .select("id")
        .eq("event_id", event.id)
        .eq("user_id", currentUserId)
        .eq("status", "confirmed")
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!currentUserId,
  });

  const formatEventDate = () => {
    const start = parseISO(event.start_time);
    const end = parseISO(event.end_time);
    const dateStr = format(start, "EEE MMM d");
    const timeStr = `${format(start, "h:mm a")}–${format(end, "h:mm a")}`;
    return { dateStr, timeStr };
  };

  const { dateStr, timeStr } = formatEventDate();
  const isFull = event.current_registrations >= event.capacity;
  const isPickleballCiti = event.courts?.name?.toLowerCase().includes("pickleball citi") || 
                           event.facility_id?.toLowerCase().includes("pickleball citi");

  const getButtonLabel = () => {
    if (isRegistered) return "Registered ✓";
    if (isFull) return "Full";
    return "Register";
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isRegistered && !isFull) {
      onRegister(event.id);
    }
  };

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-lg group h-full flex flex-col"
      onClick={() => onClick(event.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-lg leading-tight flex-1 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent group-hover:from-primary/90 group-hover:to-primary/60 transition-all">
            {event.title}
          </h3>
          <Badge
            className={
              EVENT_TYPE_COLORS[
                event.event_type as keyof typeof EVENT_TYPE_COLORS
              ]
            }
          >
            {EVENT_TYPE_LABELS[event.event_type as keyof typeof EVENT_TYPE_LABELS]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        <div className="space-y-2 text-sm text-muted-foreground flex-1">
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
              {event.current_registrations} / {event.capacity} registered
              {isFull && (
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  · Full
                </span>
              )}
            </span>
          </div>
          {event.instructor && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{event.instructor}</span>
            </div>
          )}
          {event.price > 0 && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span>${event.price}</span>
            </div>
          )}
        </div>

        {event.skill_level && (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {event.skill_level}
            </Badge>
          </div>
        )}

        {isPickleballCiti && (
          <div className="flex justify-end mb-2">
            <img 
              src={pickleballCitiLogo} 
              alt="Pickleball Citi" 
              className="h-8 w-auto object-contain opacity-70"
            />
          </div>
        )}

        <Button
          onClick={handleButtonClick}
          className="w-full"
          size="sm"
          variant={isRegistered ? "outline" : "default"}
          disabled={isRegistered || isFull}
        >
          {getButtonLabel()}
        </Button>
      </CardContent>
    </Card>
  );
}
