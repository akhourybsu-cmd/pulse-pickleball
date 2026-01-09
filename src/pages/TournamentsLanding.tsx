import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, Search, Trophy, Users, Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredTournaments = publicTournaments.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
              <Button onClick={handleCreateTournament}>
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
        <section className="py-16 bg-secondary/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">My Tournaments</h2>
              <Button variant="ghost" onClick={() => navigate("/tournament-admin")}>
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {myTournaments.slice(0, 3).map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        <Badge variant={tournament.status === "paid" ? "default" : "secondary"}>
                          {tournament.status}
                        </Badge>
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

      {/* Browse Tournaments Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Browse Tournaments</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Find and register for upcoming pickleball tournaments in your area
            </p>
          </div>

          {/* Search */}
          <div className="max-w-md mx-auto mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTournaments.length === 0 ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tournaments found</h3>
                <p className="text-muted-foreground mb-4">
                  Be the first to create a tournament!
                </p>
                <Button onClick={handleCreateTournament}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Tournament
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTournaments.map((tournament, index) => (
                <motion.div
                  key={tournament.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 h-full"
                    onClick={() => navigate(`/tournaments/${tournament.id}`)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        <Badge variant="outline">
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
          )}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Host Your Tournament</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Simple, transparent pricing to host professional tournaments
            </p>
          </div>
          <PricingShowcase onGetStarted={handleCreateTournament} />
        </div>
      </section>

      <Footer />
    </div>
  );
}
