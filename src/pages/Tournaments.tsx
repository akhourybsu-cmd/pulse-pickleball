import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, ChevronDown } from "lucide-react";
import { format } from "date-fns";

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
      {/* Hero Section */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary/80 to-accent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,232,108,0.2),transparent_50%)] animate-pulse" />
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 animate-fade-in">
            Find Your Next Pickleball Tournament
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-2xl mx-auto">
            From local showdowns to major brackets — powered by Pulse
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 text-lg px-8"
              onClick={() => navigate("/auth?redirect=/profile/edit")}
            >
              Sign Up for Pulse
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="bg-transparent border-white text-white hover:bg-white/10 text-lg px-8"
              onClick={scrollToTournaments}
            >
              View Tournaments
              <ChevronDown className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Tournaments Section */}
      <section id="tournaments-section" className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Open Tournaments</h2>
          
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
              {events.map((event) => (
                <Card 
                  key={event.id} 
                  className="hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary/50 cursor-pointer group"
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
                        className="flex-1"
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
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Why Pulse Section */}
      <section className="py-16 px-4 bg-secondary">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card p-6 rounded-lg text-center">
                  <div className="text-4xl font-bold text-primary mb-2">30,000+</div>
                  <div className="text-sm text-muted-foreground">Matches Hosted</div>
                </div>
                <div className="bg-card p-6 rounded-lg text-center">
                  <div className="text-4xl font-bold text-primary mb-2">40+</div>
                  <div className="text-sm text-muted-foreground">States Represented</div>
                </div>
                <div className="bg-card p-6 rounded-lg text-center col-span-2">
                  <div className="text-4xl font-bold text-primary mb-2">100%</div>
                  <div className="text-sm text-muted-foreground">Transparent Brackets</div>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-4xl font-bold">Why Join Pulse?</h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="font-semibold">Track your tournament history</div>
                    <div className="text-sm text-muted-foreground">All your matches in one place</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <div className="font-semibold">Join regional & national leaderboards</div>
                    <div className="text-sm text-muted-foreground">See how you stack up</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">🔔</span>
                  <div>
                    <div className="font-semibold">Get real-time updates</div>
                    <div className="text-sm text-muted-foreground">Never miss a match time</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl">💬</span>
                  <div>
                    <div className="font-semibold">Connect with players near you</div>
                    <div className="text-sm text-muted-foreground">Build your pickleball network</div>
                  </div>
                </li>
              </ul>
              <Button size="lg" onClick={() => navigate("/auth")}>
                Create My Free Player Profile
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 bg-primary/10 overflow-hidden">
        <div className="animate-[scroll_30s_linear_infinite] flex gap-8 whitespace-nowrap">
          {[
            { quote: "Pulse made my first tournament so smooth!", author: "Sarah, MA" },
            { quote: "Finally, a system that feels built for players.", author: "James, CT" },
            { quote: "Brackets updated live between games — amazing.", author: "Priya, FL" },
            { quote: "Pulse made my first tournament so smooth!", author: "Sarah, MA" },
            { quote: "Finally, a system that feels built for players.", author: "James, CT" },
          ].map((testimonial, i) => (
            <div key={i} className="inline-flex items-center gap-2 px-6 py-3 bg-card rounded-full">
              <span className="font-medium">"{testimonial.quote}"</span>
              <span className="text-muted-foreground">– {testimonial.author}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-16 px-4 bg-gradient-to-r from-primary via-accent to-primary text-white text-center">
        <div className="container mx-auto max-w-2xl space-y-6">
          <h2 className="text-5xl font-bold">Ready to Rally?</h2>
          <p className="text-xl text-white/90">Join thousands of players competing on Pulse</p>
          <div className="space-y-4">
            <Button 
              size="lg" 
              className="bg-white text-primary hover:bg-white/90 text-lg px-12"
              onClick={() => navigate("/auth")}
            >
              Join Pulse
            </Button>
            <div>
              <button 
                onClick={() => navigate("/auth")}
                className="text-white/90 hover:text-white underline"
              >
                Already have an account? Sign in.
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
