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
    return <Badge className="bg-green-600 text-white">Open</Badge>;
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
              onClick={() => navigate("/auth?redirect=/profile/edit")}
            >
              Sign Up for Pulse
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
      <section id="tournaments-section" className="py-16 px-4">
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
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 hover:scale-105 hover:border-primary cursor-pointer group h-full"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {event.name}
                      </CardTitle>
                      {getRegistrationBadge(event)}
                    </div>
                    <CardDescription className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        {event.location}
                      </div>
                      {event.divisions && event.divisions.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4" />
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
                        className="flex-1 hover:shadow-[0_0_15px_rgba(197,232,108,0.4)] transition-all"
                        onClick={() => navigate(`/tournament/${event.id}/register`)}
                      >
                        Register Team
                      </Button>
                      <Button 
                        variant="outline"
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
              <h3 className="text-2xl font-bold mb-6 text-foreground">What Makes Pulse Different</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.1 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <Users className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-foreground">Quick Match Recording</div>
                  <div className="text-sm text-foreground/70">Record your matches played at local courts in seconds</div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <MessageCircle className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-foreground">Court Connector</div>
                  <div className="text-sm text-foreground/70">Connect with players in your area and find games near you</div>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 }}
                  className="bg-card p-6 rounded-lg shadow-sm"
                >
                  <Trophy className="h-8 w-8 text-primary mb-3" />
                  <div className="font-semibold mb-2 text-foreground">Easy Round Robins</div>
                  <div className="text-sm text-foreground/70">Start your own Round Robin event with easy to use and set up features</div>
                </motion.div>
              </div>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-6"
            >
              <h2 className="text-4xl font-bold text-foreground">Why Join Pulse?</h2>
              <ul className="space-y-4">
                {[
                  { icon: Users, title: "Track your tournament history", desc: "All your matches in one place" },
                  { icon: Trophy, title: "Join regional & national leaderboards", desc: "See how you stack up" },
                  { icon: Bell, title: "Get real-time updates", desc: "Never miss a match time" },
                  { icon: MessageCircle, title: "Connect with players near you", desc: "Build your pickleball network" }
                ].map((item, i) => (
                  <motion.li 
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                    className="flex items-start gap-3"
                  >
                    <item.icon className="h-6 w-6 text-primary mt-1" />
                    <div>
                      <div className="font-semibold text-foreground">{item.title}</div>
                      <div className="text-sm text-foreground/70">{item.desc}</div>
                    </div>
                  </motion.li>
                ))}
              </ul>
              <Button 
                size="lg" 
                className="hover:shadow-[0_0_20px_rgba(197,232,108,0.4)] transition-all"
                onClick={() => navigate("/auth")}
              >
                Create My Player Profile
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
              onClick={() => navigate("/auth")}
            >
              Join Pulse
            </Button>
            <div>
              <button 
                onClick={() => navigate("/auth")}
                className="text-white/90 hover:text-white underline transition-colors"
              >
                Already have an account? Sign in.
              </button>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
