import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Users, Trophy, Sparkles, LogOut } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BackToDashboard } from "@/components/BackToDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AvailableRoundRobinEvents } from "@/components/round-robin/AvailableRoundRobinEvents";
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
  const [activeTab, setActiveTab] = useState<"my" | "participating" | "available">("my");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedEventToLeave, setSelectedEventToLeave] = useState<RoundRobinEvent | null>(null);

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
    
    // Add special styling for live events
    if (status === 'live') {
      return (
        <div className="flex items-center gap-2">
          <Badge 
            variant="default" 
            className="badge-pulse-glow"
          >
            LIVE
          </Badge>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#A9CF46] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#A9CF46]"></span>
          </span>
        </div>
      );
    }
    
    return <Badge variant={variants[status] || "outline"}>{status.toUpperCase()}</Badge>;
  };

  const getCardBackgroundClass = (status: string) => {
    const baseClasses = "cursor-pointer hover:shadow-xl transition-all duration-300 h-full relative overflow-hidden group";
    
    switch(status) {
      case 'draft':
        return `${baseClasses} bg-gradient-to-br from-card to-card/95 border-border/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]`;
      case 'live':
        return `${baseClasses} bg-gradient-to-br from-primary/5 via-card to-card/95 border-primary/30 hover:border-primary/50 hover:shadow-[0_8px_30px_rgba(169,207,70,0.25)]`;
      case 'completed':
        return `${baseClasses} bg-gradient-to-br from-card to-muted/30 border-border hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]`;
      default:
        return `${baseClasses} bg-gradient-to-br from-card to-card/95 border-border`;
    }
  };

  const handleLeaveEvent = async () => {
    if (!selectedEventToLeave || !userId) return;

    try {
      const { error } = await supabase
        .from('round_robin_players')
        .update({ active: false })
        .eq('event_id', selectedEventToLeave.id)
        .eq('player_id', userId);

      if (error) throw error;

      toast.success(`You have left ${selectedEventToLeave.name}`);
      setLeaveDialogOpen(false);
      setSelectedEventToLeave(null);
      fetchEvents();
    } catch (error: any) {
      console.error('Leave error:', error);
      toast.error('Failed to leave event');
    }
  };

  const EventCard = ({ event, isOrganizer }: { event: RoundRobinEvent; isOrganizer: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -4, scale: event.status === 'live' ? 1.03 : 1.02 }}
    >
      <Card 
        variant={event.status === 'live' ? 'pulse-accent' : 'default'}
        className={getCardBackgroundClass(event.status)}
        onClick={() => navigate(`/round-robin/${event.id}`)}
      >
        {/* Subtle hover glow overlay */}
        {event.status === 'live' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        )}
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{event.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{format(parseISO(event.date + 'T00:00:00'), 'PP')}</span>
              </CardDescription>
            </div>
            {getStatusBadge(event.status)}
          </div>
        </CardHeader>
          <CardContent className="space-y-3">
            <div className="pt-3 border-t border-border/40"></div>
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
          {!isOrganizer && event.status === 'draft' ? (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 hover:bg-primary hover:text-primary-foreground transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/round-robin/${event.id}`);
                }}
              >
                View Event
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEventToLeave(event);
                  setLeaveDialogOpen(true);
                }}
                className="hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
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
          )}
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
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        background: 'linear-gradient(to bottom, hsl(var(--page-bg)), hsl(var(--card)))',
      }}
    >
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
      <main className="container max-w-[1200px] mx-auto px-6 lg:px-10 py-6 space-y-6 relative z-10">
        {/* Hero Strip with Glow */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          {/* Pulse Green Glow Background */}
          <div 
            className="absolute inset-0 -z-10 rounded-xl blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
            style={{
              background: 'radial-gradient(circle at center, rgba(169,207,70,0.22) 0%, transparent 70%)',
            }}
          />
          <div 
            className="bg-gradient-to-br from-card via-card to-card/95 border border-border rounded-xl p-6 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-sm hover:shadow-md transition-all duration-300 group"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--card)/0.98) 100%)',
            }}
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
              className="shrink-0 shadow-md hover:shadow-lg transition-all hover:scale-105"
              data-tour="create-event-btn"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Event
            </Button>
          </div>
        </motion.div>

        {/* Tab Switcher */}
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <div className="flex justify-center">
            <TabsList className="inline-flex items-center bg-muted/50 rounded-full p-1.5 gap-1">
              <TabsTrigger value="my" className="rounded-full">
                My Events ({myEvents.length})
              </TabsTrigger>
              <TabsTrigger value="participating" className="rounded-full">
                Participating ({participatingEvents.length})
              </TabsTrigger>
              <TabsTrigger value="available" className="rounded-full">
                Browse Events
              </TabsTrigger>
            </TabsList>
          </div>

          {/* My Events */}
          <TabsContent value="my">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {myEvents.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Card className="max-w-[520px] w-full bg-white rounded-xl shadow-sm border-slate-200">
                    <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Trophy className="h-10 w-10 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">No events yet</h3>
                        <p className="text-muted-foreground text-sm">
                          Create your first Round Robin and invite players from your court.
                        </p>
                      </div>
                      <Button 
                        onClick={() => navigate("/round-robin/create")}
                        size="lg"
                        className="mt-2"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Event
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-tour="upcoming-events">
                  {myEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <EventCard event={event} isOrganizer={true} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Participating Events */}
          <TabsContent value="participating">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {participatingEvents.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Card className="max-w-[520px] w-full bg-white rounded-xl shadow-sm border-slate-200">
                    <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
                      <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-10 w-10 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">No events yet</h3>
                        <p className="text-muted-foreground text-sm">
                          You're not participating in any events yet. Check back soon!
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" data-tour="past-events">
                  {participatingEvents.map((event, index) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.05 }}
                    >
                      <EventCard event={event} isOrganizer={false} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Available Events */}
          <TabsContent value="available">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <AvailableRoundRobinEvents userId={userId} />
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button with Pulse */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ 
          scale: 1,
        }}
        whileHover={{ scale: 1.1 }}
        transition={{ delay: 0.5, type: "spring" }}
        onClick={() => navigate("/round-robin/create")}
        className="fixed bottom-8 right-8 h-14 w-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group relative"
        title="Create Event"
        style={{
          animation: 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      >
        {/* Pulsing ring effect */}
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" style={{ animationDuration: '3s' }} />
        <Plus className="h-6 w-6 group-hover:scale-110 transition-transform relative z-10" />
      </motion.button>

      {/* Leave Event Dialog */}
      <AlertDialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave "{selectedEventToLeave?.name}"? You can rejoin before the registration deadline if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedEventToLeave(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveEvent}>
              Leave Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
