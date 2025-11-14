import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, Clock, MapPin, Users, Trophy, User } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface RoundRobinEventDetailDialogProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onJoinSuccess?: () => void;
}

export function RoundRobinEventDetailDialog({
  eventId,
  isOpen,
  onClose,
  userId,
  onJoinSuccess,
}: RoundRobinEventDetailDialogProps) {
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);

  const { data: eventData, isLoading } = useQuery({
    queryKey: ["round-robin-event-detail", eventId],
    queryFn: async () => {
      // Fetch event details
      const { data: event, error: eventError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("id", eventId)
        .single();

      if (eventError) throw eventError;

      // Fetch players
      const { data: players, error: playersError } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          registration_status,
          joined_at,
          profiles:player_id (
            id,
            full_name,
            display_name
          )
        `)
        .eq("event_id", eventId)
        .eq("active", true)
        .order("joined_at", { ascending: true });

      if (playersError) throw playersError;

      // Fetch organizer
      const { data: organizer } = await supabase
        .from("profiles")
        .select("full_name, display_name")
        .eq("id", event.organizer_id)
        .single();

      // Check user registration
      let userRegistration = null;
      if (userId) {
        const { data } = await supabase
          .from("round_robin_players")
          .select("registration_status")
          .eq("event_id", eventId)
          .eq("player_id", userId)
          .eq("active", true)
          .maybeSingle();
        userRegistration = data;
      }

      const confirmedPlayers = players?.filter(p => p.registration_status === "confirmed") || [];
      const waitlistedPlayers = players?.filter(p => p.registration_status === "waitlisted") || [];

      return {
        event,
        players: players || [],
        confirmedPlayers,
        waitlistedPlayers,
        organizerName: organizer?.display_name || organizer?.full_name || "Organizer",
        userRegistration,
      };
    },
    enabled: isOpen && !!eventId,
  });

  const handleJoin = async () => {
    if (!userId) {
      toast.error("Please sign in to join events");
      return;
    }

    setIsJoining(true);
    try {
      const confirmedCount = eventData?.confirmedPlayers.length || 0;
      const maxPlayers = eventData?.event.max_players || 0;
      const status = confirmedCount >= maxPlayers ? "waitlisted" : "confirmed";

      const { error } = await supabase
        .from("round_robin_players")
        .insert({
          event_id: eventId,
          player_id: userId,
          registration_status: status,
          active: true,
        });

      if (error) throw error;

      toast.success(
        status === "confirmed"
          ? "Successfully registered!"
          : "Added to waitlist - you'll be notified if a spot opens"
      );
      
      onJoinSuccess?.();
      onClose();
    } catch (error: any) {
      console.error("Join error:", error);
      toast.error("Failed to join event");
    } finally {
      setIsJoining(false);
    }
  };

  const handleViewFullDetails = () => {
    navigate(`/round-robin/${eventId}`);
    onClose();
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-muted text-muted-foreground",
      live: "bg-primary text-primary-foreground animate-pulse",
      completed: "bg-secondary text-secondary-foreground",
    };
    return (
      <Badge className={styles[status as keyof typeof styles] || styles.draft}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!eventData && !isLoading) {
    return null;
  }

  const event = eventData?.event;
  const isRegistered = !!eventData?.userRegistration;
  const registrationOpen = event?.registration_deadline
    ? new Date(event.registration_deadline) > new Date()
    : false;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-2xl">{event?.name || "Loading..."}</DialogTitle>
          <DialogDescription>
            {event && getStatusBadge(event.status)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading event details...</div>
        ) : event ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 pb-4">
              {/* Event Info */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{format(parseISO(event.date), "EEEE, MMMM d, yyyy")}</span>
                </div>
                
                {event.start_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{event.start_time}</span>
                  </div>
                )}

                {event.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {eventData.confirmedPlayers.length}/{event.max_players || "∞"} spots filled
                  </span>
                  {eventData.waitlistedPlayers.length > 0 && (
                    <Badge variant="outline" className="ml-2">
                      {eventData.waitlistedPlayers.length} waitlisted
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>Organized by {eventData.organizerName}</span>
                </div>

                {event.rating_eligible && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary" />
                    <Badge variant="outline">Rating Eligible - {event.rating_type}</Badge>
                  </div>
                )}

                {event.registration_deadline && (
                  <div className="text-sm text-muted-foreground">
                    Registration closes: {format(parseISO(event.registration_deadline), "MMM d, yyyy h:mm a")}
                  </div>
                )}
              </div>

              {event.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2">Event Notes</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes}</p>
                  </div>
                </>
              )}

              {/* Roster */}
              <Separator />
              <div>
                <h4 className="font-semibold mb-3">Confirmed Players ({eventData.confirmedPlayers.length})</h4>
                <div className="grid grid-cols-2 gap-2">
                  {eventData.confirmedPlayers.map((player: any) => (
                    <div key={player.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {getInitials(player.profiles?.display_name || player.profiles?.full_name || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">
                        {player.profiles?.display_name || player.profiles?.full_name}
                      </span>
                    </div>
                  ))}
                </div>

                {eventData.waitlistedPlayers.length > 0 && (
                  <>
                    <h4 className="font-semibold mb-3 mt-4">Waitlist ({eventData.waitlistedPlayers.length})</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {eventData.waitlistedPlayers.map((player: any) => (
                        <div key={player.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(player.profiles?.display_name || player.profiles?.full_name || "?")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate text-muted-foreground">
                            {player.profiles?.display_name || player.profiles?.full_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}

        <Separator />
        
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          
          {isRegistered ? (
            <Button onClick={handleViewFullDetails}>
              View Full Details
            </Button>
          ) : registrationOpen && userId ? (
            <Button onClick={handleJoin} disabled={isJoining}>
              {isJoining
                ? "Joining..."
                : eventData && eventData.confirmedPlayers.length >= (event?.max_players || 0)
                ? "Join Waitlist"
                : "Join Event"}
            </Button>
          ) : !userId ? (
            <Button disabled>Sign in to Join</Button>
          ) : (
            <Button disabled>Registration Closed</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
