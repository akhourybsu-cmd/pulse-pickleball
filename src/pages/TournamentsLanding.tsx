import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Trophy, Users, Calendar, ArrowRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TournamentHero } from "@/components/tournament/TournamentHero";
import { PricingShowcase } from "@/components/tournament/PricingShowcase";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { format } from "date-fns";
import logo from "@/assets/pulse-logo-new.png";

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  divisions_count: number;
  is_public: boolean;
}

export default function TournamentsLanding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [publicTournaments, setPublicTournaments] = useState<Tournament[]>([]);
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndFetch();
  }, []);

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    // Fetch public tournaments
    const { data: publicData } = await supabase
      .from("tournaments_events")
      .select("*")
      .eq("is_public", true)
      .eq("payment_status", "paid")
      .order("start_date", { ascending: true })
      .limit(6);

    setPublicTournaments(publicData || []);

    // Fetch user's tournaments if logged in
    if (user) {
      const { data: myData } = await supabase
        .from("tournaments_events")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      setMyTournaments(myData || []);
    }

    setLoading(false);
  };

  const handleCreateTournament = () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to create a tournament",
      });
      navigate("/auth");
      return;
    }
    navigate("/tournaments/new");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return <Badge className="bg-primary/20 text-primary border-primary/30">Active</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm sticky top-0 z-50">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            {user ? (
              <Button onClick={handleCreateTournament} className="shadow-[0_0_20px_rgba(169,207,70,0.3)]">
                <Plus className="mr-2 h-4 w-4" />
                Create Tournament
              </Button>
            ) : (
              <Button onClick={() => navigate("/auth")}>Sign In</Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <TournamentHero onCreateClick={handleCreateTournament} />

      {/* My Tournaments Section (if logged in) */}
      {user && myTournaments.length > 0 && (
        <section className="py-16 bg-gradient-to-b from-muted/50 to-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">My Tournaments</h2>
              </div>
              <Button variant="ghost" onClick={() => navigate("/tournaments")} className="gap-2">
                View All <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {myTournaments.slice(0, 3).map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4, scale: 1.02 }}
                  className="cursor-pointer"
                  onClick={() => navigate(`/tournaments/${tournament.id}`)}
                >
                  <Card className="h-full bg-gradient-to-br from-card to-card/80 border-border/50 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(169,207,70,0.15)] transition-all duration-300">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        {getStatusBadge(tournament.status)}
                      </div>
                      <CardDescription className="space-y-1">
                        {tournament.location && (
                          <span className="block">{tournament.location}</span>
                        )}
                        <span className="block">
                          {format(new Date(tournament.start_date), "MMM d")} - {format(new Date(tournament.end_date), "MMM d, yyyy")}
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          {tournament.divisions_count} divisions
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Tournaments Section */}
      <section id="featured-tournaments" className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <motion.h2 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-3xl font-bold mb-2"
              >
                Featured Tournaments
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-muted-foreground"
              >
                Discover upcoming pickleball tournaments
              </motion.p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate("/tournaments/browse")}
              className="gap-2 hidden sm:flex"
            >
              Browse All <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : publicTournaments.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <Card className="max-w-md mx-auto bg-gradient-to-br from-card to-muted/30 border-border/50">
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(169,207,70,0.2)]">
                    <Trophy className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No tournaments yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Be the first to create a tournament!
                  </p>
                  <Button onClick={handleCreateTournament} className="shadow-[0_0_20px_rgba(169,207,70,0.3)]">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Tournament
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {publicTournaments.slice(0, 3).map((tournament, index) => (
                  <motion.div
                    key={tournament.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ y: -4, scale: 1.02 }}
                    className="cursor-pointer"
                    onClick={() => navigate(`/tournament/${tournament.id}`)}
                  >
                    <Card className="h-full bg-gradient-to-br from-card to-card/80 border-border/50 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(169,207,70,0.15)] transition-all duration-300">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-lg">{tournament.name}</CardTitle>
                          <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                            {tournament.divisions_count} divisions
                          </Badge>
                        </div>
                        <CardDescription className="space-y-1">
                          {tournament.location && (
                            <span className="flex items-center gap-1">
                              <span>{tournament.location}</span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(tournament.start_date), "MMM d")} - {format(new Date(tournament.end_date), "MMM d, yyyy")}
                          </span>
                        </CardDescription>
                      </CardHeader>
                      {tournament.description && (
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {tournament.description}
                          </p>
                        </CardContent>
                      )}
                    </Card>
                  </motion.div>
                ))}
              </div>
              
              {/* Mobile Browse All button */}
              <div className="mt-8 text-center sm:hidden">
                <Button 
                  onClick={() => navigate("/tournaments/browse")}
                  className="gap-2"
                >
                  Browse All Tournaments <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 bg-primary/15 text-primary px-4 py-2 rounded-full mb-6 border border-primary/30"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">Simple Pricing</span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl font-bold mb-4"
            >
              Host Your Tournament
            </motion.h2>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground max-w-2xl mx-auto"
            >
              Simple, transparent pricing to host professional tournaments
            </motion.p>
          </div>
          <PricingShowcase onGetStarted={handleCreateTournament} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
