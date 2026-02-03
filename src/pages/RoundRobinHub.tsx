import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Calendar, Users, Trophy, LogOut, 
  CalendarCheck, Monitor, TrendingUp, UserPlus, Smartphone, Zap, ArrowRight, ChevronDown
} from "lucide-react";
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
import { RoundRobinFeatureCard } from "@/components/round-robin/RoundRobinFeatureCard";
import logo from "@/assets/pulse-logo-new.png";
import { motion } from "framer-motion";
import CountUp from "react-countup";

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

interface Stats {
  eventsHosted: number;
  playersServed: number;
  courtsActive: number;
}

const FEATURES = [
  {
    icon: CalendarCheck,
    title: "Auto-Scheduling",
    description: "Intelligent court assignments that balance play time fairly across all participants."
  },
  {
    icon: Monitor,
    title: "Kiosk Mode",
    description: "Full-screen display for courts and live scoring—perfect for venue TVs."
  },
  {
    icon: Trophy,
    title: "Real-Time Leaderboards",
    description: "Watch standings update instantly as matches complete."
  },
  {
    icon: UserPlus,
    title: "Easy Registration",
    description: "Open registration with QR code check-in for seamless player management."
  },
  {
    icon: TrendingUp,
    title: "Rating Integration",
    description: "PULSE ratings update automatically after every match."
  },
  {
    icon: Smartphone,
    title: "Mobile Scoring",
    description: "Players can enter scores directly from their phones."
  }
];

export default function RoundRobinHub() {
  const navigate = useNavigate();
  const [myEvents, setMyEvents] = useState<RoundRobinEvent[]>([]);
  const [participatingEvents, setParticipatingEvents] = useState<RoundRobinEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"my" | "participating" | "available">("my");
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [selectedEventToLeave, setSelectedEventToLeave] = useState<RoundRobinEvent | null>(null);
  const [stats, setStats] = useState<Stats>({ eventsHosted: 0, playersServed: 0, courtsActive: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch aggregate stats
      const { count: eventsCount } = await supabase
        .from("round_robin_events")
        .select("*", { count: "exact", head: true });
      
      const { count: playersCount } = await supabase
        .from("round_robin_players")
        .select("*", { count: "exact", head: true });
      
      const { data: courtsData } = await supabase
        .from("round_robin_events")
        .select("num_courts");
      
      const totalCourts = courtsData?.reduce((acc, e) => acc + (e.num_courts || 0), 0) || 0;
      
      setStats({
        eventsHosted: eventsCount || 0,
        playersServed: playersCount || 0,
        courtsActive: totalCourts
      });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserId(user.id);

      const { data: organized, error: orgError } = await supabase
        .from("round_robin_events")
        .select("*")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });

      if (orgError) throw orgError;
      setMyEvents(organized || []);

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

  const scrollToTabs = () => {
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      draft: "outline",
      live: "default",
      completed: "secondary",
    };
    
    if (status === 'live') {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="default" className="badge-pulse-glow">
            LIVE
          </Badge>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
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
        {event.status === 'live' && (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
        )}
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg line-clamp-2 break-words">{event.name}</CardTitle>
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/95 to-secondary" />
        
        {/* Animated glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Top navigation */}
        <div className="relative z-20 border-b border-white/10">
          <div className="container max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <BackToDashboard variant="light-on-dark" />
            <Button 
              onClick={() => navigate("/round-robin/create")}
              size="sm"
              className="shadow-lg hover:shadow-xl"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10 container max-w-7xl mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            {/* Animated logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full scale-150" />
                <img src={logo} alt="PULSE" className="h-20 lg:h-24 w-auto relative z-10" />
              </div>
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 px-4 py-1.5 text-sm font-medium mb-6">
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Professional Tournament Management
              </Badge>
            </motion.div>

            {/* Headlines */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-4xl lg:text-6xl font-bold text-white tracking-tight mb-4"
            >
              Host Professional{" "}
              <span className="text-primary">Round Robins</span>{" "}
              in Minutes
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="text-lg lg:text-xl text-white/70 max-w-2xl mb-10"
            >
              Automated scheduling, real-time leaderboards, and kiosk mode—built for serious play.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button 
                onClick={() => navigate("/round-robin/create")}
                size="lg"
                className="text-lg px-8 py-6 shadow-[0_0_30px_rgba(169,207,70,0.4)] hover:shadow-[0_0_40px_rgba(169,207,70,0.6)] transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Round Robin
              </Button>
              <Button 
                onClick={scrollToTabs}
                variant="outline"
                size="lg"
                className="text-lg px-8 py-6 border-white/20 text-white hover:bg-white/10 hover:text-white"
              >
                Browse Events
                <ChevronDown className="h-5 w-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40"
        >
          <ChevronDown className="h-6 w-6 animate-bounce" />
        </motion.div>
      </section>

      {/* Stats Strip */}
      <section className="relative z-20 -mt-8">
        <div className="container max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="bg-card border border-border rounded-2xl shadow-xl p-6 lg:p-8"
          >
            <div className="grid grid-cols-3 gap-6 lg:gap-12">
              {[
                { label: "Events Hosted", value: stats.eventsHosted, suffix: "+" },
                { label: "Players Served", value: stats.playersServed, suffix: "+" },
                { label: "Courts Active", value: stats.courtsActive, suffix: "" }
              ].map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl lg:text-4xl font-bold text-foreground mb-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <CountUp end={stat.value} duration={2} separator="," />
                    {stat.suffix}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 lg:py-28">
        <div className="container max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-14"
          >
            <Badge variant="outline" className="mb-4">
              <Trophy className="h-3.5 w-3.5 mr-1.5" />
              Powerful Features
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Everything You Need to Run{" "}
              <span className="text-primary">World-Class Events</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              From automated scheduling to real-time leaderboards, we've built the tools that organizers actually need.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <RoundRobinFeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Events Section */}
      <section ref={tabsRef} className="py-16 lg:py-20 bg-muted/30 scroll-mt-8">
        <div className="container max-w-[1200px] mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Your Events
            </h2>
            <p className="text-muted-foreground">
              Manage your round robins or discover new ones to join
            </p>
          </motion.div>

          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <div className="flex justify-center mb-8">
              <TabsList className="inline-flex items-center bg-card border border-border rounded-full p-1.5 gap-1 shadow-sm">
                <TabsTrigger value="my" className="rounded-full px-6">
                  My Events ({myEvents.length})
                </TabsTrigger>
                <TabsTrigger value="participating" className="rounded-full px-6">
                  Participating ({participatingEvents.length})
                </TabsTrigger>
                <TabsTrigger value="available" className="rounded-full px-6">
                  Browse Events
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="my">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {myEvents.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Card className="max-w-[520px] w-full bg-card border-border rounded-2xl shadow-lg">
                      <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
                        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
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
                          className="mt-2 shadow-lg"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Create Your First Event
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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

            <TabsContent value="participating">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                {participatingEvents.length === 0 ? (
                  <div className="flex justify-center py-12">
                    <Card className="max-w-[520px] w-full bg-card border-border rounded-2xl shadow-lg">
                      <CardContent className="flex flex-col items-center text-center py-12 px-6 gap-4">
                        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Users className="h-10 w-10 text-primary" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-foreground">No events yet</h3>
                          <p className="text-muted-foreground text-sm">
                            You're not participating in any events yet. Check back soon!
                          </p>
                        </div>
                        <Button 
                          onClick={() => setActiveTab("available")}
                          variant="outline"
                          size="lg"
                          className="mt-2"
                        >
                          Browse Available Events
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-20 lg:py-24 relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/95 to-secondary" />
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-primary/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />

        <div className="relative z-10 container max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl lg:text-5xl font-bold text-white mb-4">
              Ready to Host Your First{" "}
              <span className="text-primary">Round Robin</span>?
            </h2>
            <p className="text-lg text-white/70 mb-10 max-w-xl mx-auto">
              Set up in under 2 minutes. No spreadsheets required.
            </p>
            <Button 
              onClick={() => navigate("/round-robin/create")}
              size="lg"
              className="text-lg px-10 py-6 shadow-[0_0_40px_rgba(169,207,70,0.5)] hover:shadow-[0_0_60px_rgba(169,207,70,0.7)] transition-all animate-pulse"
              style={{ animationDuration: '3s' }}
            >
              <Plus className="h-5 w-5 mr-2" />
              Get Started Now
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Floating Action Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        transition={{ delay: 0.5, type: "spring" }}
        onClick={() => navigate("/round-robin/create")}
        className="fixed bottom-8 right-8 h-14 w-14 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group relative z-50"
        title="Create Event"
      >
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
