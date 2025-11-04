import { Card } from "@/components/ui/card";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
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
  series_id?: string;
}

interface WeekCalendarGridProps {
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

export function WeekCalendarGrid({ currentDate, events, onEventClick, onTimeSlotClick, isAdmin }: WeekCalendarGridProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM
  const courts = [1, 2];
  
  const HOUR_HEIGHT = 80; // pixels per hour
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

  const getEventsForDayAndCourt = (day: Date, court: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      return isSameDay(eventStart, day) && event.court_number === court;
    });
  };

  const hasMatchingEventOnOtherCourt = (event: CalendarEvent, day: Date) => {
    const otherCourt = event.court_number === 1 ? 2 : 1;
    return events.some(e => 
      e.id !== event.id &&
      e.title === event.title &&
      e.event_type === event.event_type &&
      e.start_time === event.start_time &&
      e.court_number === otherCourt &&
      isSameDay(new Date(e.start_time), day)
    );
  };

  const renderEvent = (event: CalendarEvent, day: Date, isDoubleWide: boolean = false) => {
    const { top, height } = getEventPosition(event);
    
    return (
      <div
        key={event.id}
        className={cn(
          "absolute rounded-lg cursor-pointer hover:shadow-lg hover:z-10 transition-all border-2",
          EVENT_COLORS[event.event_type],
          isDoubleWide ? "left-0 right-0" : "left-1 right-1"
        )}
        style={{ 
          top: `${top}px`, 
          height: `${height}px`,
          minHeight: '60px'
        }}
        onClick={() => onEventClick(event)}
      >
        <div className="h-full w-full p-2 flex flex-col justify-between overflow-hidden">
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-1">
              <div className="truncate flex-1 font-semibold text-xs">{event.title}</div>
              {event.skill_level && (
                <span className={cn(
                  "text-[9px] px-1 py-0.5 rounded text-white font-bold flex-shrink-0",
                  SKILL_LEVEL_COLORS[event.skill_level]
                )}>
                  {SKILL_LEVEL_LABELS[event.skill_level]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-[10px] opacity-80">
              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
              <span className="font-medium">
                {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
              </span>
            </div>
            <div className="text-[10px] opacity-80 font-medium">
              {isDoubleWide ? "Courts 1&2" : `Court ${event.court_number}`}
            </div>
            {event.event_type === 'private' && event.rental_status && (
              <span className={cn(
                "text-[9px] px-1.5 py-0.5 rounded font-bold w-fit",
                event.rental_status === 'available' 
                  ? "bg-green-500 text-white" 
                  : "bg-gray-500 text-white"
              )}>
                {event.rental_status === 'available' ? 'Available' : 'Reserved'}
              </span>
            )}
          </div>
          {event.capacity && height > 70 && (
            <div className="text-[10px] opacity-80 font-medium">
              {event.current_registrations || 0}/{event.capacity}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[1000px]">
        {/* Header with days */}
        <div className="grid grid-cols-8 gap-1 mb-2">
          <div className="text-sm font-medium text-muted-foreground p-2">Time</div>
          {weekDays.map(day => (
            <div key={day.toISOString()} className="text-center p-2">
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div className={cn(
                "text-lg font-semibold",
                isSameDay(day, new Date()) && "text-primary"
              )}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid with events */}
        <div className="grid grid-cols-8 gap-1">
          {/* Time labels column */}
          <div className="space-y-0">
            {hours.map(hour => (
              <div 
                key={hour} 
                className="text-xs text-muted-foreground p-2 font-medium border-b border-border"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map(day => {
            const court1Events = getEventsForDayAndCourt(day, 1);
            const court2Events = getEventsForDayAndCourt(day, 2);
            
            // Find events that span both courts
            const doubleWideEvents = court1Events.filter(e => hasMatchingEventOnOtherCourt(e, day));
            const court1OnlyEvents = court1Events.filter(e => !hasMatchingEventOnOtherCourt(e, day));
            const court2OnlyEvents = court2Events.filter(e => !hasMatchingEventOnOtherCourt(e, day));

            return (
              <div key={day.toISOString()} className="relative">
                {/* Hour grid lines */}
                {hours.map(hour => (
                  <div 
                    key={hour}
                    className="border-b border-border"
                    style={{ height: `${HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* Court divider and click areas */}
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5">
                  {courts.map(court => (
                    <div 
                      key={court}
                      className="relative hover:bg-muted/20 transition-colors"
                      onClick={(e) => {
                        if (isAdmin && onTimeSlotClick && e.target === e.currentTarget) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const hour = Math.floor(y / HOUR_HEIGHT) + START_HOUR;
                          onTimeSlotClick(day, hour, court);
                        }
                      }}
                    >
                      {/* Court label for empty slots */}
                      {court === 1 && court1OnlyEvents.length === 0 && doubleWideEvents.length === 0 && (
                        <div className="absolute top-2 left-2 text-xs text-muted-foreground opacity-50">
                          Court 1
                        </div>
                      )}
                      {court === 2 && court2OnlyEvents.length === 0 && doubleWideEvents.length === 0 && (
                        <div className="absolute top-2 left-2 text-xs text-muted-foreground opacity-50">
                          Court 2
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Events layer */}
                <div className="absolute inset-0 grid grid-cols-2 gap-0.5 pointer-events-none">
                  {/* Court 1 events */}
                  <div className="relative pointer-events-auto">
                    {court1OnlyEvents.map(event => renderEvent(event, day))}
                  </div>

                  {/* Court 2 events */}
                  <div className="relative pointer-events-auto">
                    {court2OnlyEvents.map(event => renderEvent(event, day))}
                  </div>
                </div>

                {/* Double-wide events overlay */}
                {doubleWideEvents.length > 0 && (
                  <div className="absolute inset-0 pointer-events-auto px-0.5">
                    {doubleWideEvents.map(event => renderEvent(event, day, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
