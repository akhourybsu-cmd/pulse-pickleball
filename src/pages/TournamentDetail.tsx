import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, MapPin, Users, Trophy, Settings, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LockedTournamentBanner } from "@/components/tournament/LockedTournamentBanner";
import { OrderSummaryCard } from "@/components/tournament/OrderSummaryCard";
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
  is_public: boolean;
  divisions_count: number;
  payment_status: string;
  created_by: string;
}

interface Division {
  id: string;
  name: string;
  format: string | null;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  const fetchTournament = async () => {
    setLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data: tournamentData, error: tournamentError } = await supabase
      .from("tournaments_events")
      .select("*")
      .eq("id", id)
      .single();

    if (tournamentError || !tournamentData) {
      toast({
        title: "Tournament not found",
        description: "The tournament you're looking for doesn't exist",
        variant: "destructive",
      });
      navigate("/tournaments");
      return;
    }

    setTournament(tournamentData);
    setIsOwner(user?.id === tournamentData.created_by);

    // Fetch divisions
    const { data: divisionsData } = await supabase
      .from("tournaments_divisions")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    setDivisions(divisionsData || []);
    setLoading(false);
  };

  const handleContinueToPayment = async () => {
    if (!tournament) return;
    
    setCheckoutLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke("create-tournament-checkout", {
        body: { tournament_id: tournament.id },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.url) {
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      toast({
        title: "Payment error",
        description: error.message || "Could not start payment process",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading tournament...</p>
        </div>
      </div>
    );
  }

  if (!tournament) return null;

  const isPaid = tournament.payment_status === "paid";

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/tournaments">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/tournaments")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tournaments
        </Button>

        {/* Locked Banner */}
        {!isPaid && isOwner && (
          <LockedTournamentBanner
            tournamentName={tournament.name}
            divisionsCount={divisions.length}
            paymentStatus={tournament.payment_status as "draft" | "pending" | "failed"}
            onContinuePayment={handleContinueToPayment}
            isLoading={checkoutLoading}
          />
        )}

        {/* Tournament Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-bold">{tournament.name}</h1>
                {isPaid ? (
                  <Badge className="bg-primary/20 text-primary border-primary/30 shadow-[0_0_15px_rgba(169,207,70,0.3)]">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary">{tournament.payment_status}</Badge>
                )}
                {!tournament.is_public && (
                  <Badge variant="outline">Private</Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-muted-foreground flex-wrap">
                {tournament.location && (
                  <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                    <MapPin className="h-4 w-4 text-primary" />
                    {tournament.location}
                  </span>
                )}
                <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(tournament.start_date), "MMM d")} - {format(new Date(tournament.end_date), "MMM d, yyyy")}
                </span>
                <span className="flex items-center gap-1.5 bg-muted/50 px-3 py-1 rounded-full">
                  <Users className="h-4 w-4 text-primary" />
                  {divisions.length} division{divisions.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
            {isPaid && isOwner && (
              <Button variant="outline" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            )}
          </div>

          {tournament.description && (
            <p className="text-muted-foreground max-w-2xl">{tournament.description}</p>
          )}
        </motion.div>

        {/* Main Content */}
        {isPaid ? (
          <Tabs defaultValue="divisions" className="space-y-6">
            <TabsList className="bg-card/50 border border-border/50 p-1">
              <TabsTrigger value="divisions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Divisions</TabsTrigger>
              <TabsTrigger value="registrations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Registrations</TabsTrigger>
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Schedule</TabsTrigger>
              <TabsTrigger value="brackets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Brackets</TabsTrigger>
            </TabsList>

            <TabsContent value="divisions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Divisions</h2>
                <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-accent hover:opacity-90">
                  <Plus className="h-4 w-4" />
                  Add Division
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {divisions.map((division, index) => (
                  <motion.div
                    key={division.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -2 }}
                  >
                    <Card className="hover:shadow-lg hover:border-primary/30 transition-all duration-300 cursor-pointer">
                      <CardHeader>
                        <CardTitle className="text-lg">{division.name}</CardTitle>
                        <CardDescription>
                          {division.format && <span className="capitalize">{division.format}</span>}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Users className="h-4 w-4" />
                          <span>0 teams registered</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="registrations">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                <CardHeader>
                  <CardTitle>Registrations</CardTitle>
                  <CardDescription>Manage team and player registrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Registration management coming soon...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="schedule">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                <CardHeader>
                  <CardTitle>Schedule</CardTitle>
                  <CardDescription>Manage tournament schedule and courts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Schedule management coming soon...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="brackets">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                <CardHeader>
                  <CardTitle>Brackets</CardTitle>
                  <CardDescription>View and manage tournament brackets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Trophy className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Bracket management coming soon...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          /* Locked State - Show Order Summary */
          isOwner && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-xl font-semibold">Divisions</h2>
                {divisions.length === 0 ? (
                  <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No divisions added yet. Complete payment to manage your tournament.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {divisions.map((division) => (
                      <Card key={division.id} className="opacity-60 bg-gradient-to-br from-card to-muted/30 border-border/50">
                        <CardHeader>
                          <CardTitle className="text-lg">{division.name}</CardTitle>
                          <CardDescription>
                            {division.format && <span className="capitalize">{division.format}</span>}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <OrderSummaryCard
                  divisionsCount={divisions.length}
                  onCheckout={handleContinueToPayment}
                  isLoading={checkoutLoading}
                />
              </div>
            </div>
          )
        )}
      </div>

      <Footer />
    </div>
  );
}
