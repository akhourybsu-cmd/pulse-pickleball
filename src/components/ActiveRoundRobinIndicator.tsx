import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LiveEvent {
  id: string;
  name: string;
  date: string;
  current_round: number;
  num_rounds: number;
}

export function ActiveRoundRobinIndicator() {
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLiveEvents();
    
    const channel = supabase
      .channel('round-robin-status-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'round_robin_events',
          filter: `status=eq.live`
        },
        () => {
          fetchLiveEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchLiveEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);

      // Get events where user is a participant and status is live
      const { data: playerEvents, error } = await supabase
        .from("round_robin_players")
        .select(`
          event_id,
          round_robin_events!inner (
            id,
            name,
            date,
            status,
            current_round,
            num_rounds
          )
        `)
        .eq("player_id", user.id)
        .eq("round_robin_events.status", "live");

      if (error) throw error;

      const events = playerEvents
        ?.map((pe: any) => pe.round_robin_events)
        .filter(Boolean) || [];
      
      setLiveEvents(events);
    } catch (error) {
      console.error("Error fetching live events:", error);
    }
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/round-robin/${eventId}`);
  };

  if (liveEvents.length === 0) return null;

  if (liveEvents.length === 1) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleEventClick(liveEvents[0].id)}
        className="relative animate-pulse"
      >
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
        </span>
        <Trophy className="w-4 h-4 md:mr-2" />
        <span className="hidden md:inline">Active Round Robin</span>
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative animate-pulse">
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
          </span>
          <Trophy className="w-4 h-4 md:mr-2" />
          <span className="hidden md:inline">Active Round Robin ({liveEvents.length})</span>
          <span className="md:hidden">({liveEvents.length})</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Active Round Robins</SheetTitle>
          <SheetDescription>
            Select an event to view
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {liveEvents.map((event) => (
            <Card
              key={event.id}
              className="cursor-pointer hover:bg-accent transition-colors"
              onClick={() => handleEventClick(event.id)}
            >
              <CardHeader>
                <CardTitle className="text-base">{event.name}</CardTitle>
                <CardDescription>
                  Round {event.current_round}/{event.num_rounds} • {new Date(event.date).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
