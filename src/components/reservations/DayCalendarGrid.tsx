import { Card } from "@/components/ui/card";
import { format, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface CalendarEvent {
  id: string;
  title: string;
  event_type: "league" | "open_play" | "private" | "lesson";
  start_time: string;
  end_time: string;
  court_number: number;
  capacity?: number;
  current_registrations?: number;
  skill_level?: "all" | "beginner" | "intermediate" | "advanced";
  rental_status?: "available" | "reserved";
}

interface DayCalendarGridProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onTimeSlotClick?: (date: Date, hour: number, court: number) => void;
  isAdmin: boolean;
}

const EVENT_COLORS = {
  league: "bg-purple-100 border-purple-400 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
  open_play: "bg-green-100 border-green-400 text-green-900 dark:bg-green-950 dark:text-green-100",
  private: "bg-gray-100 border-gray-400 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
  lesson: "bg-blue-100 border-blue-400 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
};

const SKILL_LEVEL_LABELS = {
  all: "All",
  beginner: "Beg",
  intermediate: "Int",
  advanced: "Adv",
};

const SKILL_LEVEL_COLORS = {
  all: "bg-gray-500",
  beginner: "bg-green-500",
  intermediate: "bg-yellow-500",
  advanced: "bg-red-500",
};

export function DayCalendarGrid({ currentDate, events, onEventClick, onTimeSlotClick, isAdmin }: DayCalendarGridProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
  const courts = [1, 2];
  
  const HOUR_HEIGHT = 120; // pixels per hour (larger for day view)
  const START_HOUR = 8;

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    
    const startHour = start.getHours();
    const startMinutes = start.getMinutes();
    const endHour = end.getHours();
    const endMinutes = end.getMinutes();
    
    const topOffset = ((startHour - START_HOUR) * 60 + startMinutes) * (HOUR_HEIGHT / 60);
    const duration = ((endHour - startHour) * 60 + (endMinutes - startMinutes));
    const height = duration * (HOUR_HEIGHT / 60);
    
    return { top: topOffset, height };
  };

  const getEventsForCourt = (court: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      return isSameDay(eventStart, currentDate) && event.court_number === court;
    });
  };

  const hasMatchingEventOnOtherCourt = (event: CalendarEvent) => {
    const otherCourt = event.court_number === 1 ? 2 : 1;
    return events.some(e => 
      e.id !== event.id &&
      e.title === event.title &&
      e.event_type === event.event_type &&
      e.start_time === event.start_time &&
      e.court_number === otherCourt &&
      isSameDay(new Date(e.start_time), currentDate)
    );
  };

  const court1Events = getEventsForCourt(1);
  const court2Events = getEventsForCourt(2);
  
  const doubleWideEvents = court1Events.filter(e => hasMatchingEventOnOtherCourt(e));
  const court1OnlyEvents = court1Events.filter(e => !hasMatchingEventOnOtherCourt(e));
  const court2OnlyEvents = court2Events.filter(e => !hasMatchingEventOnOtherCourt(e));

  const renderEvent = (event: CalendarEvent, isDoubleWide: boolean = false) => {
    const { top, height } = getEventPosition(event);
    
    return (
      <div
        key={event.id}
        className={cn(
          "absolute rounded-lg cursor-pointer hover:shadow-lg hover:z-10 transition-all border-2",
          EVENT_COLORS[event.event_type],
          isDoubleWide ? "left-0 right-0" : "left-2 right-2"
        )}
        style={{ 
          top: `${top}px`, 
          height: `${height}px`,
          minHeight: '80px'
        }}
        onClick={() => onEventClick(event)}
      >
        <div className="h-full w-full p-3 flex flex-col justify-between overflow-hidden">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="truncate flex-1 font-semibold text-base">{event.title}</div>
              {event.skill_level && (
                <span className={cn(
                  "text-xs px-2 py-1 rounded text-white font-bold flex-shrink-0",
                  SKILL_LEVEL_COLORS[event.skill_level]
                )}>
                  {SKILL_LEVEL_LABELS[event.skill_level]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">
                {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
              </span>
            </div>
            <div className="text-sm opacity-80 font-medium">
              {isDoubleWide ? "Courts 1 & 2" : `Court ${event.court_number}`}
            </div>
            {event.event_type === 'private' && event.rental_status && (
              <span className={cn(
                "text-xs px-2 py-1 rounded font-bold w-fit",
                event.rental_status === 'available' 
                  ? "bg-green-500 text-white" 
                  : "bg-gray-500 text-white"
              )}>
                {event.rental_status === 'available' ? 'Available for Rent' : 'Reserved'}
              </span>
            )}
          </div>
          {event.capacity && height > 100 && (
            <div className="text-sm opacity-80 font-medium">
              {event.current_registrations || 0}/{event.capacity} registered
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[100px_1fr] gap-4">
      {/* Time labels */}
      <div className="space-y-0">
        {hours.map(hour => (
          <div 
            key={hour}
            className="text-sm font-semibold border-b border-border flex items-start pt-2"
            style={{ height: `${HOUR_HEIGHT}px` }}
          >
            {format(new Date().setHours(hour, 0), "h:mm a")}
          </div>
        ))}
      </div>

      {/* Courts grid */}
      <div className="relative">
        {/* Hour grid lines */}
        {hours.map(hour => (
          <div 
            key={hour}
            className="border-b border-border"
            style={{ height: `${HOUR_HEIGHT}px` }}
          />
        ))}

        {/* Court columns with click areas */}
        <div className="absolute inset-0 grid grid-cols-2 gap-3">
          {courts.map(court => (
            <div 
              key={court}
              className="relative border-r last:border-r-0 border-border hover:bg-muted/20 transition-colors rounded-lg"
              onClick={(e) => {
                if (isAdmin && onTimeSlotClick && e.target === e.currentTarget) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  const hour = Math.floor(y / HOUR_HEIGHT) + START_HOUR;
                  onTimeSlotClick(currentDate, hour, court);
                }
              }}
            >
              {/* Court label */}
              {((court === 1 && court1OnlyEvents.length === 0 && doubleWideEvents.length === 0) ||
                (court === 2 && court2OnlyEvents.length === 0 && doubleWideEvents.length === 0)) && (
                <div className="absolute top-4 left-4 text-sm text-muted-foreground opacity-50 font-medium">
                  Court {court}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Events overlay */}
        <div className="absolute inset-0 grid grid-cols-2 gap-3 pointer-events-none">
          {/* Court 1 events */}
          <div className="relative pointer-events-auto">
            {court1OnlyEvents.map(event => renderEvent(event))}
          </div>

          {/* Court 2 events */}
          <div className="relative pointer-events-auto">
            {court2OnlyEvents.map(event => renderEvent(event))}
          </div>
        </div>

        {/* Double-wide events overlay */}
        {doubleWideEvents.length > 0 && (
          <div className="absolute inset-0 pointer-events-auto px-1.5">
            {doubleWideEvents.map(event => renderEvent(event, true))}
          </div>
        )}
      </div>
    </div>
  );
}
