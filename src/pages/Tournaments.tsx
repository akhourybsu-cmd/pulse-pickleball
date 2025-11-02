import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, ChevronDown, Trophy, Bell, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { PageHeader } from "@/components/PageHeader";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string;
  start_date: string;
  end_date: string;
  status: string;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  waitlist_enabled: boolean;
  divisions?: Array<{
    id: string;
    name: string;
    format: string;
    max_teams: number | null;
  }>;
}

export default function Tournaments() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchOpenTournaments();
  }, []);

  const fetchOpenTournaments = async () => {
    const { data, error } = await supabase
      .from("tournaments_events")
      .select(`
        *,
        divisions:tournaments_divisions(id, name, format, max_teams)
      `)
      .eq("public_view_enabled", true)
      .eq("registration_enabled", true)
      .or(`registration_close_date.is.null,registration_close_date.gte.${new Date().toISOString()}`)
      .in("status", ["draft", "upcoming", "live"])
      .order("start_date", { ascending: true });

    if (error) {
      console.error("Error fetching tournaments:", error);
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const getRegistrationBadge = (event: TournamentEvent) => {
    const now = new Date();
    const openDate = event.registration_open_date ? new Date(event.registration_open_date) : null;
    const closeDate = event.registration_close_date ? new Date(event.registration_close_date) : null;

    if (openDate && openDate > now) {
      return <Badge variant="secondary">Opens {format(openDate, "MMM d")}</Badge>;
    }
    if (closeDate && closeDate < now) {
      return <Badge variant="outline">Closed</Badge>;
    }
    return <Badge className="bg-green-600 text-white shadow-[0_0_6px_rgba(34,197,94,0.6)]">Open</Badge>;
  };

  const scrollToTournaments = () => {
    document.getElementById("tournaments-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={userId} />
      
      {/* Hero Section */}
      <section className="relative min-h-[300px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-accent">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 animate-[gradient_8s_ease_infinite] bg-[length:200%_100%]" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-4 text-center relative z-10"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Find Your Next Pickleball Tournament
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto drop-shadow">
            From local showdowns to major brackets — powered by Pulse
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 hover:shadow-[0_0_20px_rgba(197,232,108,0.5)] transition-all duration-300 text-lg px-8"
              onClick={() => navigate(userId ? "/dashboard" : "/auth?redirect=/profile/edit")}
            >
              {userId ? "Go to Dashboard" : "Sign Up for Pulse"}
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary transition-all duration-300 text-lg px-8"
              onClick={scrollToTournaments}
            >
              View Tournaments
              <ChevronDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Tournaments Section */}
      <section id="tournaments-section" className="py-16 px-4 bg-[radial-gradient(circle_at_top_center,rgba(197,232,108,0.15),#ffffff_70%)]">
        <div className="container mx-auto">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-4xl font-bold text-center mb-12"
          >
            Open Tournaments
          </motion.h2>
          
          {loading ? (
            <div className="text-center py-12">Loading tournaments...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl text-muted-foreground mb-6">
                No tournaments currently open for registration.
              </p>
              <Button onClick={() => navigate("/auth")}>
                Sign Up to Get Notified
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  whileHover={{ 
                    y: -4,
                    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.1), 0 0 18px rgba(197, 232, 108, 0.45)"
                  }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  className="border border-primary/30 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.05),0_0_12px_rgba(197,232,108,0.25)] bg-card hover:border-primary/50 transition-all duration-300 h-full group"
                >
                  <Card className="border-0 shadow-none bg-transparent h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-xl group-hover:text-primary transition-colors relative pb-3">
                          {event.name}
                          <span className="absolute left-0 bottom-0 h-[3px] w-10 bg-gradient-to-r from-primary to-accent rounded-full animate-[pulseFlow_3s_ease-in-out_infinite]" />
                        </CardTitle>
                        {getRegistrationBadge(event)}
                      </div>
                      <CardDescription className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
                          <Calendar className="h-4 w-4 text-primary/60" />
                          {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
                          <MapPin className="h-4 w-4 text-primary/60" />
                          {event.location}
                        </div>
                        {event.divisions && event.divisions.length > 0 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
                            <Users className="h-4 w-4 text-primary/60" />
                            {event.divisions.length} {event.divisions.length === 1 ? "Division" : "Divisions"}
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                      
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 hover:shadow-[0_0_15px_rgba(197,232,108,0.5)] hover:scale-[1.02] transition-all duration-200"
                          onClick={() => navigate(`/tournament/${event.id}/register`)}
                        >
                          Register Team
                        </Button>
                        <Button 
                          variant="outline"
                          className="hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                          onClick={() => navigate(`/tournament/${event.id}`)}
                        >
                          Learn More
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Pulse Section */}
      <section className="py-16 px-4 bg-secondary">
        <div className="container mx-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid md:grid-cols-2 gap-12 items-center"
          >
            <div className="space-y-6">
              <h3 className="text-2xl font-bold mb-6 text-white">What Makes Pulse Different</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <Users className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-card-foreground">Quick Match Recording</div>
                  <div className="text-sm text-card-foreground/80">Record your matches played at local courts in seconds</div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <MessageCircle className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-card-foreground">Court Connector</div>
                  <div className="text-sm text-card-foreground/80">Connect with players in your area and find games near you</div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <Trophy className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-card-foreground">Easy Round Robins</div>
                  <div className="text-sm text-card-foreground/80">Start your own Round Robin event with easy to use and set up features</div>
                </motion.div>
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-4xl font-bold text-white">Why Join Pulse?</h2>
              <div className="space-y-4 text-white/90 text-lg leading-relaxed">
                <p>
                  Pulse isn't just another app—it's your region's pickleball community, all in one place. 
                  Whether you're looking to find your next doubles partner, join a weekend Round Robin, 
                  or compete in a local tournament, Pulse connects you to the courts and players that matter most.
                </p>
                <p>
                  Track every match you play, see how you stack up on regional leaderboards, and discover 
                  games happening at courts near you. From casual pickup games to competitive tournaments, 
                  Pulse keeps you connected to the heartbeat of pickleball in your area.
                </p>
                <p className="text-white font-semibold">
                  One platform. Your local courts. Your community.
                </p>
              </div>
              <Button 
                size="lg" 
                className="hover:shadow-[0_0_20px_rgba(197,232,108,0.4)] transition-all"
                onClick={() => navigate(userId ? "/dashboard" : "/auth")}
              >
                {userId ? "Go to Dashboard" : "Create My Player Profile"}
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Community Strip */}
      <section className="py-16 bg-primary/10 overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background z-10 pointer-events-none" />
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <p className="text-2xl font-semibold text-foreground px-4">
            Join tournaments in your region — from local rec centers to regional championships.
          </p>
        </motion.div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary via-accent to-primary text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 animate-[gradient_8s_ease_infinite] bg-[length:200%_100%]" />
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="container mx-auto max-w-2xl space-y-6 relative z-10"
        >
          <h2 className="text-5xl font-bold drop-shadow-lg">Ready to Rally?</h2>
          <p className="text-xl text-white/90">One platform. Every court. All in Pulse.</p>
          <div className="space-y-4">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] hover:scale-105 transition-all duration-300 text-lg px-12 animate-[pulse_3s_ease-in-out_infinite]"
              onClick={() => navigate(userId ? "/dashboard" : "/auth")}
            >
              {userId ? "Go to Dashboard" : "Join Pulse"}
            </Button>
            {!userId && (
              <div>
                <button 
                  onClick={() => navigate("/auth")}
                  className="text-white/90 hover:text-white underline transition-colors"
                >
                  Already have an account? Sign in.
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
