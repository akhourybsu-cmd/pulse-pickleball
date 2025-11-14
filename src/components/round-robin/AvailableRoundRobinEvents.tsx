import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock, Trophy } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import { RoundRobinEventDetailDialog } from "./RoundRobinEventDetailDialog";

export function AvailableRoundRobinEvents({ userId }: { userId: string | null }) {
  const navigate = useNavigate();
  const [joiningEvent, setJoiningEvent] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const { data: events = [], refetch } = useQuery({
    queryKey: ['available-round-robin-events', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('round_robin_events')
        .select(`
          *,
          round_robin_players(count)
        `)
        .eq('is_published', true)
        .eq('registration_mode', 'open_registration')
        .gte('registration_deadline', new Date().toISOString())
        .order('date', { ascending: true });

      if (error) throw error;

      // Enrich with registration counts and organizer info
      const enrichedEvents = await Promise.all(
        (data || []).map(async (event) => {
          const { data: players } = await supabase
            .from('round_robin_players')
            .select('id, registration_status')
            .eq('event_id', event.id)
            .eq('active', true);

          const confirmed = players?.filter(p => p.registration_status === 'confirmed').length || 0;
          const waitlisted = players?.filter(p => p.registration_status === 'waitlisted').length || 0;
          
          // Check if current user is already registered
          const { data: myReg } = await supabase
            .from('round_robin_players')
            .select('registration_status')
            .eq('event_id', event.id)
            .eq('player_id', userId || '')
            .eq('active', true)
            .maybeSingle();

          // Get organizer info
          const { data: organizer } = await supabase
            .from('profiles')
            .select('full_name, display_name')
            .eq('id', event.organizer_id)
            .single();

          return {
            ...event,
            confirmed_count: confirmed,
            waitlisted_count: waitlisted,
            is_registered: !!myReg,
            my_status: myReg?.registration_status,
            organizer_name: organizer?.display_name || organizer?.full_name || 'Organizer'
          };
        })
      );

      return enrichedEvents;
    },
    enabled: !!userId
  });

  const handleJoinEvent = async (eventId: string, maxPlayers: number, confirmedCount: number) => {
    if (!userId) {
      toast.error("Please sign in to join events");
      return;
    }

    setJoiningEvent(eventId);
    try {
      const status = confirmedCount >= maxPlayers ? 'waitlisted' : 'confirmed';
      
      const { error } = await supabase
        .from('round_robin_players')
        .insert({
          event_id: eventId,
          player_id: userId,
          registration_status: status,
          active: true
        });

      if (error) throw error;

      toast.success(
        status === 'confirmed' 
          ? 'Successfully registered!' 
          : 'Added to waitlist - you\'ll be notified if a spot opens'
      );
      refetch();
    } catch (error: any) {
      console.error('Join error:', error);
      toast.error('Failed to join event');
    } finally {
      setJoiningEvent(null);
    }
  };

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No events available</h3>
          <p className="text-muted-foreground">
            There are no open registration events at this time. Check back soon!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {events.map((event) => {
        const eventDate = parseISO(event.date + 'T00:00:00');
        const deadline = parseISO(event.registration_deadline);
        const isFull = event.confirmed_count >= event.max_players;

        return (
          <Card key={event.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-lg">{event.name}</CardTitle>
                {event.is_registered && (
                  <Badge variant={event.my_status === 'confirmed' ? 'default' : 'secondary'}>
                    {event.my_status === 'confirmed' ? 'Registered' : 'Waitlisted'}
                  </Badge>
                )}
              </div>
              <CardDescription className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{format(eventDate, 'EEE, MMM d, yyyy')}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{event.location}</span>
                  </div>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    Capacity
                  </span>
                  <span className="font-medium">
                    {event.confirmed_count} / {event.max_players}
                    {event.waitlisted_count > 0 && (
                      <span className="text-muted-foreground ml-1">
                        (+{event.waitlisted_count} waitlist)
                      </span>
                    )}
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    Registration closes
                  </span>
                  <span className="text-xs">{format(deadline, 'MMM d, h:mm a')}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Trophy className="h-4 w-4" />
                    Organized by
                  </span>
                  <span className="text-xs">{event.organizer_name}</span>
                </div>
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
                {!event.is_registered && !isPast(deadline) && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleJoinEvent(event.id, event.max_players, event.confirmed_count)}
                    disabled={joiningEvent === event.id}
                  >
                    {joiningEvent === event.id 
                      ? 'Joining...' 
                      : isFull ? 'Join Waitlist' : 'Join Event'
                    }
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

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
