import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, Clock, Users, MapPin, Edit, CheckCircle, Copy } from "lucide-react";
import { toast } from "sonner";

interface Attendee {
  id: string;
  user_id: string;
  status: string;
  joined_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface EventDetailDialogProps {
  eventId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  onEdit?: (eventId: string) => void;
  onDuplicate?: (eventId: string) => void;
  onRefresh: () => void;
}

export function EventDetailDialog({
  eventId,
  open,
  onOpenChange,
  isAdmin,
  onEdit,
  onDuplicate,
  onRefresh,
}: EventDetailDialogProps) {
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [waitlist, setWaitlist] = useState<Attendee[]>([]);
  const [userStatus, setUserStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (eventId && open) {
      fetchEventDetails();
    }
  }, [eventId, open]);

  const fetchEventDetails = async () => {
    if (!eventId) return;

    try {
      const { data: eventData, error: eventError } = await supabase
        .from("citi_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      const { data: attendeesData, error: attendeesError } = await supabase
        .from("citi_event_attendees")
        .select(`
          id,
          user_id,
          status,
          joined_at
        `)
        .eq("event_id", eventId)
        .order("joined_at");

      // Fetch profile data separately
      const userIds = attendeesData?.map((a: any) => a.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profilesMap = new Map(
        profilesData?.map((p: any) => [p.id, p]) || []
      );

      // Enrich attendees with profile data
      const enrichedAttendees = attendeesData?.map((a: any) => ({
        ...a,
        profiles: profilesMap.get(a.user_id) || { full_name: "Unknown", avatar_url: null }
      }));

      if (attendeesError) throw attendeesError;

      const attending = enrichedAttendees.filter(
        (a: any) => a.status === "attending" || a.status === "checked_in"
      );
      const waitlisted = enrichedAttendees.filter((a: any) => a.status === "waitlisted");

      setAttendees(attending);
      setWaitlist(waitlisted);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userAttendance = enrichedAttendees.find((a: any) => a.user_id === user.id);
        setUserStatus(userAttendance?.status || null);
      }
    } catch (error: any) {
      console.error("Error fetching event details:", error);
      toast.error("Failed to load event details");
    }
  };

  const handleJoin = async () => {
    if (!eventId || !event) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const isFull = attendees.length >= event.max_players;
      const status = isFull ? "waitlisted" : "attending";

      const { error } = await supabase.from("citi_event_attendees").insert({
        event_id: eventId,
        user_id: user.id,
        status,
      });

      if (error) throw error;

      toast.success(isFull ? "Added to waitlist" : "Successfully joined event");
      fetchEventDetails();
      onRefresh();
    } catch (error: any) {
      console.error("Error joining event:", error);
      toast.error(error.message || "Failed to join event");
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!eventId) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("citi_event_attendees")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", user.id);

      if (error) throw error;

      // Auto-promote from waitlist if someone left
      if (userStatus === "attending" && waitlist.length > 0) {
        const firstWaitlisted = waitlist[0];
        await supabase
          .from("citi_event_attendees")
          .update({
            status: "attending",
            promoted_at: new Date().toISOString(),
          })
          .eq("id", firstWaitlisted.id);
      }

      toast.success("Left event");
      fetchEventDetails();
      onRefresh();
    } catch (error: any) {
      console.error("Error leaving event:", error);
      toast.error("Failed to leave event");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (attendeeId: string) => {
    try {
      const { error } = await supabase
        .from("citi_event_attendees")
        .update({
          status: "checked_in",
          checkin_timestamp: new Date().toISOString(),
        })
        .eq("id", attendeeId);

      if (error) throw error;
      toast.success("Marked as checked in");
      fetchEventDetails();
    } catch (error: any) {
      console.error("Error checking in:", error);
      toast.error("Failed to check in");
    }
  };

  const handlePromoteFromWaitlist = async (attendeeId: string) => {
    try {
      const { error } = await supabase
        .from("citi_event_attendees")
        .update({
          status: "attending",
          promoted_at: new Date().toISOString(),
        })
        .eq("id", attendeeId);

      if (error) throw error;
      toast.success("Promoted from waitlist");
      fetchEventDetails();
      onRefresh();
    } catch (error: any) {
      console.error("Error promoting:", error);
      toast.error("Failed to promote");
    }
  };

  if (!event) return null;

  const formatEventDateTime = () => {
    const start = new Date(event.start_time);
    const end = new Date(event.end_time);
    return {
      date: format(start, "EEEE, MMMM d, yyyy"),
      time: `${format(start, "h:mm a")} – ${format(end, "h:mm a")}`,
    };
  };

  const { date, time } = formatEventDateTime();
  const isFull = attendees.length >= event.max_players;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-2xl">{event.title}</DialogTitle>
              <DialogDescription>Hosted by Pickleball Citi</DialogDescription>
            </div>
            {isAdmin && (
              <div className="flex gap-2">
                {onDuplicate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDuplicate(event.id)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(event.id)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{date}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{time}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>
                  {attendees.length} / {event.max_players} going
                  {isFull && " · Full"}
                </span>
              </div>
              {waitlist.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>Waitlist: {waitlist.length}</span>
                </div>
              )}
            </div>

            {event.description && (
              <div>
                <h4 className="font-medium mb-2">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {event.skill_tag && (
                <Badge variant="outline">{event.skill_tag}</Badge>
              )}
              {event.price_label && (
                <Badge variant="outline">{event.price_label}</Badge>
              )}
            </div>

            {!isAdmin && (
              <div className="flex gap-2">
                {!userStatus && (
                  <Button
                    onClick={handleJoin}
                    disabled={loading}
                    className="flex-1"
                  >
                    {isFull ? "Join Waitlist" : "Join Event"}
                  </Button>
                )}
                {userStatus && (
                  <Button
                    onClick={handleLeave}
                    disabled={loading}
                    variant="outline"
                    className="flex-1"
                  >
                    Leave Event
                  </Button>
                )}
              </div>
            )}

            <Separator />

            <div>
              <h4 className="font-medium mb-3">
                Attendees ({attendees.length})
              </h4>
              <div className="space-y-2">
                {attendees.map((attendee: any) => (
                  <div
                    key={attendee.id}
                    className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={attendee.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {attendee.profiles?.full_name?.charAt(0) || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {attendee.profiles?.full_name || "Unknown"}
                      </span>
                      {attendee.status === "checked_in" && (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Checked In
                        </Badge>
                      )}
                    </div>
                    {isAdmin && attendee.status === "attending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCheckIn(attendee.id)}
                      >
                        Check In
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {isAdmin && waitlist.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3">
                    Waitlist ({waitlist.length})
                  </h4>
                  <div className="space-y-2">
                    {waitlist.map((person: any, index: number) => (
                      <div
                        key={person.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">
                            {index + 1}.
                          </span>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={person.profiles?.avatar_url || ""} />
                            <AvatarFallback>
                              {person.profiles?.full_name?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {person.profiles?.full_name || "Unknown"}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handlePromoteFromWaitlist(person.id)}
                        >
                          Promote
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
