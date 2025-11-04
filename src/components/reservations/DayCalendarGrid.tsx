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

  const getEventsForSlot = (date: Date, hour: number, court: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventStartHour = eventStart.getHours();
      
      return isSameDay(eventStart, date) && 
        eventStartHour === hour && 
        event.court_number === court;
    });
  };
  
  const getEventSpan = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(1, Math.ceil(hours));
  };
  
  const isHourCovered = (date: Date, hour: number, court: number) => {
    return events.some(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();
      
      return isSameDay(eventStart, date) && 
        event.court_number === court &&
        hour > eventStartHour && 
        hour < eventEndHour;
    });
  };

  const hasEventOnBothCourts = (date: Date, hour: number) => {
    const court1Events = getEventsForSlot(date, hour, 1);
    const court2Events = getEventsForSlot(date, hour, 2);
    
    if (court1Events.length > 0 && court2Events.length > 0) {
      const event1 = court1Events[0];
      const event2 = court2Events[0];
      return event1.title === event2.title && event1.event_type === event2.event_type;
    }
    return false;
  };

  return (
    <div className="space-y-2">
      {hours.map(hour => {
        const bothCourts = hasEventOnBothCourts(currentDate, hour);
        const isCovered = isHourCovered(currentDate, hour, 1) || isHourCovered(currentDate, hour, 2);
        
        // Skip if covered by multi-hour event
        if (isCovered && !bothCourts) {
          return null;
        }
        
        return (
          <div key={hour} className="grid grid-cols-[100px_1fr] gap-3">
            <div className="text-sm font-semibold p-3 flex items-center">
              {format(new Date().setHours(hour, 0), "h:mm a")}
            </div>
            
            {bothCourts ? (
              (() => {
                const slotEvents = getEventsForSlot(currentDate, hour, 1);
                if (slotEvents.length === 0) return null;
                
                const span = getEventSpan(slotEvents[0]);
                const minHeight = 100 * span + (span - 1) * 8;
                
                return (
                  <Card
                    className="p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow border-0"
                    style={{ minHeight: `${minHeight}px` }}
                    onClick={() => onEventClick(slotEvents[0])}
                  >
                    {slotEvents.map(event => (
                      <div
                        key={event.id}
                        className={cn(
                          "h-full w-full p-4 flex flex-col justify-between",
                          EVENT_COLORS[event.event_type]
                        )}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="truncate flex-1 font-semibold text-base">{event.title}</div>
                            {event.skill_level && (
                              <span className={cn(
                                "text-xs px-2 py-1 rounded text-white font-bold",
                                SKILL_LEVEL_COLORS[event.skill_level]
                              )}>
                                {SKILL_LEVEL_LABELS[event.skill_level]}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm opacity-80">
                            <Clock className="w-4 h-4" />
                            <span className="font-medium">
                              {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                            </span>
                          </div>
                          <div className="text-sm opacity-80 font-medium">Courts 1 & 2</div>
                        </div>
                        {event.capacity && (
                          <div className="text-sm opacity-80 font-medium">
                            {event.current_registrations || 0}/{event.capacity} registered
                          </div>
                        )}
                      </div>
                    ))}
                  </Card>
                );
              })()
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {courts.map(court => {
                  const slotEvents = getEventsForSlot(currentDate, hour, court);
                  const covered = isHourCovered(currentDate, hour, court);
                  
                  if (covered) return null;
                  
                  const span = slotEvents.length > 0 ? getEventSpan(slotEvents[0]) : 1;
                  const minHeight = 100 * span + (span - 1) * 8;
                  
                  return (
                    <Card
                      key={court}
                      className={cn(
                        "p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow",
                        slotEvents.length === 0 && "bg-muted/30 border min-h-[100px]"
                      )}
                      style={slotEvents.length > 0 ? { minHeight: `${minHeight}px` } : undefined}
                      onClick={() => {
                        if (slotEvents.length > 0) {
                          onEventClick(slotEvents[0]);
                        } else if (isAdmin && onTimeSlotClick) {
                          onTimeSlotClick(currentDate, hour, court);
                        }
                      }}
                    >
                      {slotEvents.length > 0 ? (
                        slotEvents.map(event => (
                          <div
                            key={event.id}
                            className={cn(
                              "h-full w-full p-3 flex flex-col justify-between",
                              EVENT_COLORS[event.event_type]
                            )}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-1">
                                <div className="truncate flex-1 font-semibold text-sm">{event.title}</div>
                                {event.skill_level && (
                                  <span className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded text-white font-bold",
                                    SKILL_LEVEL_COLORS[event.skill_level]
                                  )}>
                                    {SKILL_LEVEL_LABELS[event.skill_level]}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-xs opacity-80">
                                <Clock className="w-3 h-3" />
                                <span className="font-medium">
                                  {format(new Date(event.start_time), "h:mm a")} - {format(new Date(event.end_time), "h:mm a")}
                                </span>
                              </div>
                              <div className="text-xs opacity-80 font-medium">Court {court}</div>
                            </div>
                            {event.capacity && (
                              <div className="text-xs opacity-80 font-medium">
                                {event.current_registrations || 0}/{event.capacity}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="min-h-[100px] flex items-center justify-center text-sm text-muted-foreground opacity-50">
                          Court {court}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
