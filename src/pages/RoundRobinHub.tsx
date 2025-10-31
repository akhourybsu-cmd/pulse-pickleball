import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, Trophy } from "lucide-react";
import { toast } from "sonner";
import { BackToDashboard } from "@/components/BackToDashboard";
import logo from "@/assets/pulse-logo-new.png";

interface RoundRobinEvent {
  id: string;
  name: string;
  date: string;
  status: string;
  current_round: number;
  num_rounds: number;
  num_courts: number;
  organizer_id: string;
}

export default function RoundRobinHub() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState<RoundRobinEvent[]>([]);
  const [participatingEvents, setParticipatingEvents] = useState<RoundRobinEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      // Fetch events I organize
      const { data: organized, error: orgError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });

      if (orgError) throw orgError;
      setMyEvents(organized || []);

      // Fetch events I'm participating in
      const { data: playerEvents, error: playerError } = await supabase
        .from("round_robin_players")
        .select(`
          event_id,
          round_robin_events (*)
        `)
        .eq("player_id", user.id);

      if (playerError) throw playerError;
      
      const participatingList = playerEvents
        ?.map((pe: any) => pe.round_robin_events)
        .filter((e: any) => e.organizer_id !== user.id) || [];
      
      setParticipatingEvents(participatingList);
    } catch (error: any) {
      toast.error("Failed to load events");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      live: "default",
      completed: "secondary",
    };
    return <Badge variant={variants[status] || "outline"}>{status.toUpperCase()}</Badge>;
  };

  const EventCard = ({ event, isOrganizer }: { event: RoundRobinEvent; isOrganizer: boolean }) => (
    <Card 
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => navigate(`/round-robin/${event.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{event.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Calendar className="h-3 w-3" />
              {new Date(event.date).toLocaleDateString()}
            </CardDescription>
          </div>
          {getStatusBadge(event.status)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            Round {event.current_round}/{event.num_rounds}
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            {event.num_courts} {event.num_courts === 1 ? "Court" : "Courts"}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-secondary border-b">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap text-white">Round Robin by</h1>
              <img src={logo} alt="PULSE" className="h-[56px] w-auto" />
            </div>
            <BackToDashboard className="text-white hover:text-white/80" />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="organizing" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="organizing">My Events ({myEvents.length})</TabsTrigger>
            <TabsTrigger value="participating">Participating ({participatingEvents.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="organizing" className="mt-6 space-y-4">
            {myEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">No events yet</p>
                  <Button onClick={() => navigate("/round-robin/create")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Event
                  </Button>
                </CardContent>
              </Card>
            ) : (
              myEvents.map((event) => (
                <EventCard key={event.id} event={event} isOrganizer={true} />
              ))
            )}
          </TabsContent>

          <TabsContent value="participating" className="mt-6 space-y-4">
            {participatingEvents.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You're not in any events yet</p>
                </CardContent>
              </Card>
            ) : (
              participatingEvents.map((event) => (
                <EventCard key={event.id} event={event} isOrganizer={false} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
