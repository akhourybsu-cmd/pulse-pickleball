import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, Trophy, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BackToDashboard } from "@/components/BackToDashboard";
import logo from "@/assets/pulse-logo-new.png";
import { motion } from "framer-motion";

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
  const [activeTab, setActiveTab] = useState<"my" | "participating">("my");

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
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all h-full border-slate-200 bg-white"
        onClick={() => navigate(`/round-robin/${event.id}`)}
      >
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{event.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{new Date(event.date).toLocaleDateString()}</span>
              </CardDescription>
            </div>
            {getStatusBadge(event.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 shrink-0" />
              <span className="truncate">Round {event.current_round}/{event.num_rounds}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{event.num_courts} {event.num_courts === 1 ? "Court" : "Courts"}</span>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full hover:bg-primary hover:text-primary-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/round-robin/${event.id}`);
            }}
          >
            {isOrganizer ? "Manage" : "View"} Event
          </Button>
        </CardContent>
      </Card>
    </motion.div>
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

  const currentEvents = activeTab === "my" ? myEvents : participatingEvents;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-10 bg-secondary border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold whitespace-nowrap text-white">Round Robin by</h1>
              <img src={logo} alt="PULSE" className="h-[67px] w-auto" />
            </div>
            <BackToDashboard className="text-white hover:text-white/80" />
          </div>
        </div>
      </header>

      {/* Content Container */}
      <main className="container max-w-[1200px] mx-auto px-6 lg:px-10 py-6 space-y-6">
        {/* Hero Strip */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent border border-slate-200 rounded-xl p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              Your Round Robin Events
            </h2>
            <p className="text-muted-foreground text-sm lg:text-base">
              Create, manage, and join events for your courts.
            </p>
          </div>
          <Button 
            onClick={() => navigate("/round-robin/create")}
            size="lg"
            className="shrink-0 shadow-md hover:shadow-lg transition-all"
            data-tour="create-event-btn"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Event
          </Button>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          <div className="inline-flex items-center bg-muted/50 rounded-full p-1.5 gap-1">
            <button
              onClick={() => setActiveTab("my")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "my"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              My Events ({myEvents.length})
            </button>
            <button
              onClick={() => setActiveTab("participating")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === "participating"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Participating ({participatingEvents.length})
            </button>
          </div>
        </motion.div>

        {/* Content Area */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {currentEvents.length === 0 ? (
            <div className="flex justify-center py-12">
              <Card className="max-w-[520px] w-full bg-white rounded-xl shadow-sm border-slate-200">
                <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    {activeTab === "my" ? (
                      <Trophy className="h-10 w-10 text-primary" />
                    ) : (
                      <Users className="h-10 w-10 text-primary" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">No events yet</h3>
                    <p className="text-muted-foreground text-sm">
                      {activeTab === "my" 
                        ? "Create your first Round Robin and invite players from your court."
                        : "You're not participating in any events yet. Check back soon!"}
                    </p>
                  </div>
                  {activeTab === "my" && (
                    <Button 
                      onClick={() => navigate("/round-robin/create")}
                      size="lg"
                      className="mt-2"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Event
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-tour={activeTab === "my" ? "upcoming-events" : "past-events"}>
              {currentEvents.map((event) => (
                <EventCard key={event.id} event={event} isOrganizer={activeTab === "my"} />
              ))}
            </div>
          )}
        </motion.div>
      </main>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        onClick={() => navigate("/round-robin/create")}
        className="fixed bottom-8 right-8 h-14 w-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Create Event"
      >
        <Plus className="h-6 w-6 group-hover:scale-110 transition-transform" />
      </motion.button>
    </div>
  );
}
