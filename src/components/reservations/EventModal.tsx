import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, DollarSign, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface EventModalProps {
  event: {
    id: string;
    title: string;
    event_type: "league" | "open_play" | "private" | "lesson";
    start_time: string;
    end_time: string;
    court_number: number;
    capacity?: number;
    current_registrations?: number;
    price?: number;
    instructor?: string;
    description?: string;
    skill_level?: "all" | "beginner" | "intermediate" | "advanced";
    series_id?: string | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string | null;
  isAdmin?: boolean;
  onRegister?: (eventId: string) => void;
  onRequestPrivate?: (eventId: string) => void;
  onEdit?: (event: any) => void;
}

const EVENT_TYPE_LABELS = {
  league: "League",
  open_play: "Open Play",
  private: "Private Rental",
  lesson: "Lesson",
};

const EVENT_TYPE_COLORS = {
  league: "bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-100",
  open_play: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100",
  private: "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100",
  lesson: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
};

const SKILL_LEVEL_FULL_LABELS = {
  all: "All Levels",
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function EventModal({ event, isOpen, onClose, currentUserId, isAdmin, onRegister, onRequestPrivate, onEdit }: EventModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch registrations for this event
  const { data: registrations = [], refetch: refetchRegistrations } = useQuery({
    queryKey: ["event-registrations", event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      
      const { data, error } = await supabase
        .from("calendar_event_registrations")
        .select(`
          *,
          profiles:user_id (
            id,
            full_name,
            display_name,
            avatar_url
          )
        `)
        .eq("event_id", event.id)
        .eq("status", "confirmed");
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!event?.id && isOpen,
  });

  // Check if current user is registered
  const userRegistration = registrations.find(r => r.user_id === currentUserId);
  const isRegistered = !!userRegistration;

  // Fetch all series events if this is a league with series_id
  const { data: seriesEvents } = useQuery({
    queryKey: ["series-events", event?.series_id],
    queryFn: async () => {
      if (!event?.series_id) return [];
      
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("series_id", event.series_id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!event?.series_id && event?.event_type === "league" && isOpen,
  });

  // Calculate unique session count by grouping events on same date
  const uniqueSessions = seriesEvents ? 
    new Set(seriesEvents.map(e => new Date(e.start_time).toDateString())).size 
    : 0;

  if (!event) return null;

  const startTime = new Date(event.start_time);
  const endTime = new Date(event.end_time);
  const isFull = event.capacity && registrations.length >= event.capacity;

  const handleAction = async () => {
    if (!currentUserId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to register for events",
      });
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (event.event_type === "private" && onRequestPrivate) {
      onRequestPrivate(event.id);
      return;
    }

    // Handle registration
    try {
      const { error } = await supabase
        .from("calendar_event_registrations")
        .insert({
          event_id: event.id,
          user_id: currentUserId,
          status: "confirmed",
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already registered",
            description: "You're already registered for this event",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Registration successful",
        description: "You've been registered for this event",
      });
      await refetchRegistrations();
      onRegister?.(event.id);
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Error",
        description: "Failed to register. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleCancelRegistration = async () => {
    if (!userRegistration) return;

    try {
      const { error } = await supabase
        .from("calendar_event_registrations")
        .delete()
        .eq("id", userRegistration.id);

      if (error) throw error;

      toast({
        title: "Registration cancelled",
        description: "Your registration has been cancelled",
      });
      await refetchRegistrations();
    } catch (error) {
      console.error("Cancel error:", error);
      toast({
        title: "Error",
        description: "Failed to cancel registration",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {event.title}
            <Badge className={EVENT_TYPE_COLORS[event.event_type]}>
              {EVENT_TYPE_LABELS[event.event_type]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {event.event_type === "league" && seriesEvents && seriesEvents.length > 1 ? (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(new Date(seriesEvents[0].start_time), "MMMM d, yyyy")} -{" "}
                  {format(new Date(seriesEvents[seriesEvents.length - 1].start_time), "MMMM d, yyyy")}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {format(startTime, "EEEE")}s at{" "}
                  {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")} ({uniqueSessions} sessions)
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(startTime, "EEEE, MMMM d, yyyy")}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}</span>
              </div>
            </>
          )}

          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>
              {event.court_number === 0 ? "Courts 1 & 2" : `Court ${event.court_number}`}
            </span>
          </div>

          {event.skill_level && (
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {SKILL_LEVEL_FULL_LABELS[event.skill_level]}
              </Badge>
            </div>
          )}

          {event.capacity && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span>{registrations.length} / {event.capacity} registered</span>
              {isFull && <Badge variant="destructive">Full</Badge>}
            </div>
          )}

          {event.price !== undefined && event.price > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span>${event.price.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">(No payment required at this time)</span>
            </div>
          )}

          {event.instructor && (
            <div className="text-sm">
              <span className="text-muted-foreground">Instructor: </span>
              <span className="font-medium">{event.instructor}</span>
            </div>
          )}

          {event.description && (
            <p className="text-sm text-muted-foreground">{event.description}</p>
          )}

          {/* Roster Section */}
          {registrations.length > 0 && event.event_type !== "league" && event.event_type !== "private" && (
            <div className="mt-6 pt-6 border-t">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Registered Players ({registrations.length}{event.capacity ? ` / ${event.capacity}` : ""})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {registrations.map((reg: any) => (
                  <div key={reg.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reg.profiles?.avatar_url} />
                      <AvatarFallback>
                        {(reg.profiles?.display_name || reg.profiles?.full_name || "U").charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">
                      {reg.profiles?.display_name || reg.profiles?.full_name || "Unknown"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {registrations.length === 0 && event.event_type !== "league" && event.event_type !== "private" && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground text-center">
                No one has registered yet. Be the first!
              </p>
            </div>
          )}

          {/* Admin Edit Button */}
          {isAdmin && onEdit && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                onEdit(event);
                onClose();
              }}
            >
              Edit Event
            </Button>
          )}

          {/* Action buttons */}
          {!isAdmin && (
            <div className="flex gap-2 pt-4">
              {event.event_type === "open_play" && !isRegistered && (
                <Button 
                  className="flex-1"
                  onClick={handleAction}
                  disabled={isFull}
                  style={
                    !isFull ? {
                      backgroundColor: '#B9E43B',
                      color: '#0E4C58',
                    } : undefined
                  }
                  variant={isFull ? "outline" : "default"}
                >
                  {isFull ? "Event Full" : "Register"}
                </Button>
              )}

              {event.event_type === "open_play" && isRegistered && (
                <Button 
                  className="flex-1"
                  variant="destructive"
                  onClick={handleCancelRegistration}
                >
                  Cancel Registration
                </Button>
              )}

              {event.event_type === "private" && (
                <Button 
                  className="flex-1"
                  variant="outline"
                  onClick={handleAction}
                >
                  Request Rental
                </Button>
              )}

              {event.event_type === "lesson" && !isRegistered && (
                <Button 
                  className="flex-1"
                  onClick={handleAction}
                  disabled={isFull}
                  style={
                    !isFull ? {
                      backgroundColor: '#B9E43B',
                      color: '#0E4C58',
                    } : undefined
                  }
                  variant={isFull ? "outline" : "default"}
                >
                  {isFull ? "Event Full" : "Book Lesson"}
                </Button>
              )}

              {event.event_type === "lesson" && isRegistered && (
                <Button 
                  className="flex-1"
                  variant="destructive"
                  onClick={handleCancelRegistration}
                >
                  Cancel Registration
                </Button>
              )}

              {event.event_type === "league" && (
                <div className="flex-1 p-3 bg-muted rounded-lg text-sm text-center">
                  League registration managed separately
                </div>
              )}

              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          )}

          {!isAdmin && !currentUserId && (
            <p className="text-xs text-center text-muted-foreground">
              Sign in to register for this event
            </p>
          )}

          {isAdmin && (
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
