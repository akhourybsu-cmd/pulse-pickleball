import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { EventTile } from "./EventTile";
import { EventDetailDialog } from "./EventDetailDialog";
import { CreateEventDialog } from "./CreateEventDialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface UpcomingEventsProps {
  courtId: string;
  isAdmin: boolean;
}

export function UpcomingEvents({ courtId, isAdmin }: UpcomingEventsProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editEventId, setEditEventId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
    
    // Set up realtime subscription
    const channel = supabase
      .channel(`citi-events-${courtId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'citi_events',
          filter: `court_id=eq.${courtId}`,
        },
        () => {
          fetchEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'citi_event_attendees',
        },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [courtId]);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch events
      const { data: eventsData, error: eventsError } = await supabase
        .from("citi_events")
        .select("*")
        .eq("court_id", courtId)
        .gte("end_time", new Date().toISOString())
        .order("start_time");

      if (eventsError) throw eventsError;

      // Fetch attendees for all events
      const { data: attendeesData, error: attendeesError } = await supabase
        .from("citi_event_attendees")
        .select("event_id, status, user_id")
        .in(
          "event_id",
          eventsData.map((e: any) => e.id)
        );

      if (attendeesError) throw attendeesError;

      // Process events with attendee data
      const processedEvents = eventsData.map((event: any) => {
        const eventAttendees = attendeesData.filter(
          (a: any) => a.event_id === event.id
        );
        const attending = eventAttendees.filter(
          (a: any) => a.status === "attending" || a.status === "checked_in"
        );
        const waitlisted = eventAttendees.filter(
          (a: any) => a.status === "waitlisted"
        );
        const userAttendance = user
          ? eventAttendees.find((a: any) => a.user_id === user.id)
          : null;

        return {
          ...event,
          attendee_count: attending.length,
          waitlist_count: waitlisted.length,
          user_status: userAttendance?.status || "none",
          is_full: attending.length >= event.max_players,
        };
      });

      setEvents(processedEvents);
    } catch (error: any) {
      console.error("Error fetching events:", error);
    }
  };

  const handleJoin = async (eventId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to join events");
        return;
      }

      const event = events.find((e) => e.id === eventId);
      const isFull = event.attendee_count >= event.max_players;

      const { error } = await supabase.from("citi_event_attendees").insert({
        event_id: eventId,
        user_id: user.id,
        status: isFull ? "waitlisted" : "attending",
      });

      if (error) throw error;
      toast.success(isFull ? "Added to waitlist" : "Joined event!");
      fetchEvents();
    } catch (error: any) {
      console.error("Error joining event:", error);
      toast.error(error.message || "Failed to join event");
    }
  };

  const handleLeave = async (eventId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("citi_event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Left event");
      fetchEvents();
    } catch (error: any) {
      console.error("Error leaving event:", error);
      toast.error("Failed to leave event");
    }
  };

  const handleJoinWaitlist = async (eventId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in to join waitlist");
        return;
      }

      const { error } = await supabase.from("citi_event_attendees").insert({
        event_id: eventId,
        user_id: user.id,
        status: "waitlisted",
      });

      if (error) throw error;
      toast.success("Added to waitlist");
      fetchEvents();
    } catch (error: any) {
      console.error("Error joining waitlist:", error);
      toast.error(error.message || "Failed to join waitlist");
    }
  };

  if (events.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <>
      <Card className="border border-border bg-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            Upcoming Events
          </CardTitle>
          {isAdmin && (
            <Button
              size="sm"
              onClick={() => {
                setEditEventId(null);
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8 px-4 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground mb-4">
                No upcoming sessions at Pickleball Citi.
              </p>
              {isAdmin && (
                <Button
                  onClick={() => {
                    setEditEventId(null);
                    setCreateDialogOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Event
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="w-full">
              <div className="flex gap-4 pb-4">
                {events.map((event) => (
                  <EventTile
                    key={event.id}
                    event={event}
                    isAdmin={isAdmin}
                    onJoin={handleJoin}
                    onLeave={handleLeave}
                    onJoinWaitlist={handleJoinWaitlist}
                    onClick={setSelectedEventId}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <EventDetailDialog
        eventId={selectedEventId}
        open={selectedEventId !== null}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        isAdmin={isAdmin}
        onEdit={(id) => {
          setEditEventId(id);
          setSelectedEventId(null);
          setCreateDialogOpen(true);
        }}
        onRefresh={fetchEvents}
      />

      <CreateEventDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        courtId={courtId}
        eventId={editEventId}
        onSuccess={fetchEvents}
      />
    </>
  );
}
