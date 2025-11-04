import { Card } from "@/components/ui/card";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";

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

  const getEventsForSlot = (date: Date, hour: number, court: number) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      const eventHour = eventDate.getHours();
      return isSameDay(eventDate, date) && eventHour === hour && event.court_number === court;
    });
  };

  const hasEventOnBothCourts = (date: Date, hour: number) => {
    const court1Events = getEventsForSlot(date, hour, 1);
    const court2Events = getEventsForSlot(date, hour, 2);
    
    // Check if there's a matching event on both courts (same title and type)
    if (court1Events.length > 0 && court2Events.length > 0) {
      const event1 = court1Events[0];
      const event2 = court2Events[0];
      return event1.title === event2.title && event1.event_type === event2.event_type;
    }
    return false;
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

        {/* Time slots */}
        <div className="space-y-1">
          {hours.map(hour => (
            <div key={hour} className="grid grid-cols-8 gap-1">
              <div className="text-xs text-muted-foreground p-2 font-medium">
                {format(new Date().setHours(hour, 0), "h:mm a")}
              </div>
              {weekDays.map(day => {
                const bothCourts = hasEventOnBothCourts(day, hour);
                
                return (
                  <div key={`${day.toISOString()}-${hour}`}>
                    {bothCourts ? (
                      // Single card spanning both courts - full height
                      <Card
                        key={`${day.toISOString()}-${hour}-both`}
                        className={cn(
                          "p-2 min-h-[130px] cursor-pointer hover:shadow-md transition-shadow"
                        )}
                        onClick={() => {
                          const slotEvents = getEventsForSlot(day, hour, 1);
                          if (slotEvents.length > 0) {
                            onEventClick(slotEvents[0]);
                          }
                        }}
                      >
                        {getEventsForSlot(day, hour, 1).map(event => (
                          <div
                            key={event.id}
                            className={cn(
                              "p-1 rounded border text-xs font-medium space-y-0.5",
                              EVENT_COLORS[event.event_type]
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <div className="truncate flex-1">{event.title}</div>
                              {event.skill_level && (
                                <span className={cn(
                                  "text-[9px] px-1 rounded text-white font-bold",
                                  SKILL_LEVEL_COLORS[event.skill_level]
                                )}>
                                  {SKILL_LEVEL_LABELS[event.skill_level]}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] opacity-70">Courts 1&2</div>
                            {event.capacity && (
                              <div className="text-[10px] opacity-70">
                                {event.current_registrations || 0}/{event.capacity}
                              </div>
                            )}
                          </div>
                        ))}
                      </Card>
                    ) : (
                      // Separate cards for each court
                      <div className="space-y-1">
                        {courts.map(court => {
                        const slotEvents = getEventsForSlot(day, hour, court);
                        return (
                          <Card
                            key={`${day.toISOString()}-${hour}-${court}`}
                            className={cn(
                              "p-2 min-h-[60px] cursor-pointer hover:shadow-md transition-shadow",
                              slotEvents.length === 0 && "bg-muted/30"
                            )}
                            onClick={() => {
                              if (slotEvents.length > 0) {
                                onEventClick(slotEvents[0]);
                              } else if (isAdmin && onTimeSlotClick) {
                                onTimeSlotClick(day, hour, court);
                              }
                            }}
                          >
                            {slotEvents.length > 0 ? (
                              slotEvents.map(event => (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "p-1 rounded border text-xs font-medium space-y-0.5",
                                    EVENT_COLORS[event.event_type]
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <div className="truncate flex-1">{event.title}</div>
                                    {event.skill_level && (
                                      <span className={cn(
                                        "text-[9px] px-1 rounded text-white font-bold",
                                        SKILL_LEVEL_COLORS[event.skill_level]
                                      )}>
                                        {SKILL_LEVEL_LABELS[event.skill_level]}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] opacity-70">Court {court}</div>
                                  {event.capacity && (
                                    <div className="text-[10px] opacity-70">
                                      {event.current_registrations || 0}/{event.capacity}
                                    </div>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="text-xs text-muted-foreground opacity-50">
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
          ))}
        </div>
      </div>
    </div>
  );
}
