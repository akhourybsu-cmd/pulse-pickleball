import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Calendar, Clock, Users, MapPin, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useState } from "react";
import { RoundRobinEventDetailDialog } from "./RoundRobinEventDetailDialog";

interface JoinableRoundRobinEventsProps {
  courtLocation: string;
  userId: string | null;
}

interface EnrichedEvent {
  id: string;
  name: string;
  date: string;
  start_time?: string;
  location: string;
  max_players: number;
  registration_deadline: string;
  rating_eligible: boolean;
  rating_type: string;
  confirmed_count: number;
  waitlisted_count: number;
  is_registered: boolean;
  my_status?: string;
  organizer_name: string;
}

export function JoinableRoundRobinEvents({ courtLocation, userId }: JoinableRoundRobinEventsProps) {
  const navigate = useNavigate();
  const [joiningEvent, setJoiningEvent] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: events = [], refetch } = useQuery({
    queryKey: ["joinable-round-robin-events", courtLocation, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("is_published", true)
        .eq("registration_mode", "open_registration")
        .gte("registration_deadline", new Date().toISOString())
        .ilike("location", `%${courtLocation}%`)
        .order("date", { ascending: true })
        .limit(3);
      
      if (error) throw error;

      // Enrich with registration counts and organizer info
      const enrichedEvents: EnrichedEvent[] = await Promise.all(
        (data || []).map(async (event) => {
          const { data: players } = await supabase
            .from("round_robin_players")
            .select("id, registration_status")
            .eq("event_id", event.id)
            .eq("active", true);

          const confirmed = players?.filter(p => p.registration_status === "confirmed").length || 0;
          const waitlisted = players?.filter(p => p.registration_status === "waitlisted").length || 0;
          
          // Check if current user is registered
          let myReg = null;
          if (userId) {
            const { data } = await supabase
              .from("round_robin_players")
              .select("registration_status")
              .eq("event_id", event.id)
              .eq("player_id", userId)
              .eq("active", true)
              .maybeSingle();
            myReg = data;
          }

          // Get organizer info
          const { data: organizer } = await supabase
            .from("profiles")
            .select("full_name, display_name")
            .eq("id", event.organizer_id)
            .single();

          return {
            id: event.id,
            name: event.name,
            date: event.date,
            start_time: event.start_time,
            location: event.location,
            max_players: event.max_players,
            registration_deadline: event.registration_deadline,
            rating_eligible: event.rating_eligible,
            rating_type: event.rating_type,
            confirmed_count: confirmed,
            waitlisted_count: waitlisted,
            is_registered: !!myReg,
            my_status: myReg?.registration_status,
            organizer_name: organizer?.display_name || organizer?.full_name || "Organizer"
          };
        })
      );

      return enrichedEvents;
    },
  });

  const handleJoinEvent = async (eventId: string, maxPlayers: number, confirmedCount: number) => {
    if (!userId) {
      toast.error("Please sign up to join events", {
        action: {
          label: "Join Pulse",
          onClick: () => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`),
        },
      });
      return;
    }

    setJoiningEvent(eventId);
    try {
      const status = confirmedCount >= maxPlayers ? "waitlisted" : "confirmed";
      
      const { data: newRegistration, error } = await supabase
        .from("round_robin_players")
        .insert({
          event_id: eventId,
          player_id: userId,
          registration_status: status,
          active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Send confirmation email
      if (newRegistration) {
        try {
          await supabase.functions.invoke("send-round-robin-confirmation", {
            body: { registrationId: newRegistration.id }
          });
        } catch (emailError) {
          console.error("Failed to send confirmation email:", emailError);
        }
      }

      toast.success(
        status === "confirmed" 
          ? "Registration confirmed! Check your email for details." 
          : "Added to waitlist - you'll be notified if a spot opens"
      );
      refetch();
    } catch (error: any) {
      console.error("Join error:", error);
      if (error.code === "23505") {
        toast.error("You're already registered for this event");
      } else {
        toast.error("Failed to join event");
      }
    } finally {
      setJoiningEvent(null);
    }
  };

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#0E4C58" }}>
          <Trophy className="w-6 h-6" style={{ color: "#A9DC3D" }} />
          Upcoming Events
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/browse-events")}
          className="gap-2"
        >
          View Events
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event, index) => {
          const eventDate = parseISO(event.date + 'T00:00:00');
          const deadline = parseISO(event.registration_deadline);
          const isFull = event.confirmed_count >= event.max_players;

          return (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
            >
              <Card className="cursor-pointer rounded-2xl border-2 border-border shadow-lg hover:shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(169,220,61,0.15)] transition-all duration-300 h-full bg-card">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="text-xl line-clamp-1">{event.name}</CardTitle>
                    {event.is_registered && (
                      <Badge variant={event.my_status === "confirmed" ? "default" : "secondary"}>
                        {event.my_status === "confirmed" ? "Registered" : "Waitlisted"}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-sm">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>{event.location}</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{format(eventDate, "MMM d, yyyy")}</span>
                  </div>
                  {event.start_time && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>Event Time: {format(new Date(`2000-01-01T${event.start_time}`), 'h:mm a')}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span>Register by {format(deadline, "MMM d, h:mm a")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>
                      {event.confirmed_count}/{event.max_players} spots
                      {event.waitlisted_count > 0 && (
                        <span className="ml-1">(+{event.waitlisted_count} waitlist)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedEventId(event.id)}
                    >
                      View Details
                    </Button>
                    {!event.is_registered && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => handleJoinEvent(event.id, event.max_players, event.confirmed_count)}
                        disabled={joiningEvent === event.id}
                        style={{
                          backgroundColor: "#B9E43B",
                          color: "#0E4C58",
                        }}
                      >
                        {joiningEvent === event.id 
                          ? "Joining..." 
                          : isFull ? "Join Waitlist" : "Join Event"
                        }
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Event Detail Modal */}
      {selectedEventId && (
        <RoundRobinEventDetailDialog
          eventId={selectedEventId}
          isOpen={!!selectedEventId}
          onClose={() => setSelectedEventId(null)}
          userId={userId}
          onJoinSuccess={refetch}
        />
      )}
    </div>
  );
}
