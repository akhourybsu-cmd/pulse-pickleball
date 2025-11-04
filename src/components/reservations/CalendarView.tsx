import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { format, addDays, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { WeekCalendarGrid } from "./WeekCalendarGrid";
import { DayCalendarGrid } from "./DayCalendarGrid";
import { EventModal } from "./EventModal";
import { CreateEventDialog } from "./CreateEventDialog";
import { EditEventDialog } from "./EditEventDialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CalendarViewProps {
  facilityId: string;
  currentUserId: string | null;
}

export function CalendarView({ facilityId, currentUserId }: CalendarViewProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [createDefaults, setCreateDefaults] = useState<any>({});
  
  const hasMatchingEventOnOtherCourt = (event: any) => {
    const otherCourt = event.court_number === 1 ? 2 : 1;
    return events.some(e => 
      e.id !== event.id &&
      e.title === event.title &&
      e.event_type === event.event_type &&
      e.start_time === event.start_time &&
      e.court_number === otherCourt
    );
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", currentUserId],
    queryFn: async () => {
      if (!currentUserId) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: currentUserId,
        _role: "admin"
      });
      return data || false;
    },
    enabled: !!currentUserId,
  });

  // Fetch calendar events
  const { data: events = [], refetch } = useQuery({
    queryKey: ["calendar-events", facilityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .order("start_time", { ascending: true });
      
      if (error) throw error;
      return (data || []).map(event => ({
        ...event,
        event_type: event.event_type as "league" | "open_play" | "private" | "lesson",
        skill_level: event.skill_level as "all" | "beginner" | "intermediate" | "advanced" | undefined,
        rental_status: event.rental_status as "available" | "reserved" | undefined,
        series_id: event.series_id || undefined,
      }));
    },
  });

  const handleTimeSlotClick = (date: Date, hour: number, court: number) => {
    setCreateDefaults({ date, hour, court });
    setCreateDialogOpen(true);
  };

  const handleCreateEvent = async (eventData: any) => {
    try {
      const { error } = await supabase
        .from("calendar_events")
        .insert(eventData);
      
      if (error) throw error;
      
      await refetch();
      toast({
        title: "Event created",
        description: "The event has been added to the calendar",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive",
      });
    }
  };

  const handleRegister = async (eventId: string) => {
    toast({
      title: "Registration successful",
      description: "You've been registered for this event",
    });
    // TODO: Actually register user
  };

  const handleRequestPrivate = async (eventId: string) => {
    toast({
      title: "Request submitted",
      description: "Your private rental request has been sent to the admin",
    });
    // TODO: Actually create request
  };

  const handleEditEvent = async (eventId: string, eventData: any, updateType?: "single" | "series") => {
    try {
      // Find the event to get its series_id
      const eventToEdit = events.find(e => e.id === eventId);
      
      if (updateType === "series" && eventToEdit?.series_id) {
        // Update all events in the series
        const { error } = await supabase
          .from("calendar_events")
          .update(eventData)
          .eq("series_id", eventToEdit.series_id);
        
        if (error) throw error;
      } else {
        // Update only this event
        const { error } = await supabase
          .from("calendar_events")
          .update(eventData)
          .eq("id", eventId);
        
        if (error) throw error;
      }
      
      await refetch();
      toast({
        title: "Event updated",
        description: updateType === "series" 
          ? "All events in the series have been updated" 
          : "The event has been updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    }
  };

  const handleDeleteEvent = async (eventId: string, deleteType?: "single" | "series") => {
    try {
      // Find the event to get its series_id
      const eventToDelete = events.find(e => e.id === eventId);
      
      if (deleteType === "series" && eventToDelete?.series_id) {
        // Delete all events in the series
        const { error } = await supabase
          .from("calendar_events")
          .delete()
          .eq("series_id", eventToDelete.series_id);
        
        if (error) throw error;
      } else {
        // Check if this event has a matching event on another court (double-wide event)
        const matchingEvent = events.find(e => 
          e.id !== eventId &&
          e.title === eventToDelete?.title &&
          e.event_type === eventToDelete?.event_type &&
          e.start_time === eventToDelete?.start_time &&
          e.end_time === eventToDelete?.end_time &&
          e.court_number !== eventToDelete?.court_number
        );
        
        if (matchingEvent) {
          // Delete both events (the one on this court and the matching one)
          const { error } = await supabase
            .from("calendar_events")
            .delete()
            .in("id", [eventId, matchingEvent.id]);
          
          if (error) throw error;
        } else {
          // Delete only this event
          const { error } = await supabase
            .from("calendar_events")
            .delete()
            .eq("id", eventId);
          
          if (error) throw error;
        }
      }
      
      await refetch();
      toast({
        title: "Event deleted",
        description: deleteType === "series"
          ? "All events in the series have been removed"
          : "The event has been removed from the calendar",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (event: any) => {
    setEditingEvent(event);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={view} onValueChange={(v) => setView(v as "week" | "day")}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week View</SelectItem>
              <SelectItem value="day">Day View</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Create Event
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(view === "week" ? subWeeks(currentDate, 1) : addDays(currentDate, -1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[200px] text-center">
            {view === "week" 
              ? `${format(weekDays[0], "MMM d")} - ${format(weekDays[6], "MMM d, yyyy")}`
              : format(currentDate, "MMMM d, yyyy")}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(view === "week" ? addWeeks(currentDate, 1) : addDays(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-purple-400" />
          <span>League</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-400" />
          <span>Open Play</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-gray-400" />
          <span>Private Rental</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span>Lesson</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card className="p-4">
        {view === "week" ? (
          <WeekCalendarGrid
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onTimeSlotClick={isAdmin ? handleTimeSlotClick : undefined}
            isAdmin={isAdmin || false}
          />
        ) : (
          <DayCalendarGrid
            currentDate={currentDate}
            events={events}
            onEventClick={setSelectedEvent}
            onTimeSlotClick={isAdmin ? handleTimeSlotClick : undefined}
            isAdmin={isAdmin || false}
          />
        )}
      </Card>

      {/* Event Modal */}
      <EventModal
        event={selectedEvent ? {
          ...selectedEvent,
          court_number: hasMatchingEventOnOtherCourt(selectedEvent) ? 0 : selectedEvent.court_number
        } : null}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
        currentUserId={currentUserId}
        isAdmin={isAdmin || false}
        onRegister={handleRegister}
        onRequestPrivate={handleRequestPrivate}
        onEdit={openEditDialog}
      />

      {/* Create Event Dialog */}
      <CreateEventDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        defaultDate={createDefaults.date}
        defaultHour={createDefaults.hour}
        defaultCourt={createDefaults.court}
        onSubmit={handleCreateEvent}
        facilityId={facilityId}
      />

      {/* Edit Event Dialog */}
      <EditEventDialog
        isOpen={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        onSubmit={handleEditEvent}
        onDelete={handleDeleteEvent}
        seriesCount={editingEvent?.series_id 
          ? events.filter(e => e.series_id === editingEvent.series_id).length 
          : 0
        }
      />
    </div>
  );
}
