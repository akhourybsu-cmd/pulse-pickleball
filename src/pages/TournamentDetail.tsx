import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, MapPin, Users, Trophy, Settings, Edit, Trash2, ExternalLink, Copy, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { LockedTournamentBanner } from "@/components/tournament/LockedTournamentBanner";
import { OrderSummaryCard } from "@/components/tournament/OrderSummaryCard";
import { DivisionManager } from "@/components/tournament/DivisionManager";
import { RegistrationsPanel } from "@/components/tournament/RegistrationsPanel";
import { CourtManagementPanel } from "@/components/tournament/CourtManagementPanel";
import { EditTournamentDialog } from "@/components/tournament/EditTournamentDialog";
import { TournamentHealthCard } from "@/components/tournament/TournamentHealthCard";
import { CheckInDashboard } from "@/components/tournament/CheckInDashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { format } from "date-fns";
import logo from "@/assets/pulse-logo-premium.svg";

interface Tournament {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled";
  is_public: boolean;
  divisions_count: number;
  payment_status: string;
  created_by: string;
  paid_divisions_count: number;
  public_view_enabled: boolean;
  registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  waitlist_enabled: boolean;
  created_at: string;
}

interface Division {
  id: string;
  name: string;
  format: string | null;
  skill_level?: string | null;
  team_count?: number;
}

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchTournament();
    }
  }, [id]);

  // Handle division purchase success callback
  useEffect(() => {
    if (searchParams.get("division_purchased") === "true") {
      handleDivisionPurchaseSuccess();
      searchParams.delete("division_purchased");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const handleDivisionPurchaseSuccess = async () => {
    if (!id) return;
    
    const { error } = await supabase
      .from("tournaments_events")
      .update({ paid_divisions_count: (tournament?.paid_divisions_count || 3) + 1 })
      .eq("id", id);

    if (!error) {
      toast({
        title: "Division slot purchased!",
        description: "You can now add another division to your tournament.",
      });
      fetchTournament();
    }
  };

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

    // Fetch team counts per division
    const divisionIds = (divisionsData || []).map(d => d.id);
    let teamCounts: Record<string, number> = {};
    
    if (divisionIds.length > 0) {
      const { data: teamsData } = await supabase
        .from("tournaments_teams")
        .select("division_id")
        .in("division_id", divisionIds);
      
      (teamsData || []).forEach(team => {
        teamCounts[team.division_id] = (teamCounts[team.division_id] || 0) + 1;
      });
    }

    // Merge team counts into divisions
    const divisionsWithCounts = (divisionsData || []).map(div => ({
      ...div,
      team_count: teamCounts[div.id] || 0,
    }));

    setDivisions(divisionsWithCounts);
    setLoading(false);
  };

  const handleUpdateTournament = async (updates: Partial<Tournament>) => {
    const { error } = await supabase
      .from("tournaments_events")
      .update(updates)
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating tournament",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tournament updated",
        description: "Changes saved successfully",
      });
      fetchTournament();
    }
  };

  const handleDeleteTournament = async () => {
    const { error } = await supabase
      .from("tournaments_events")
      .delete()
      .eq("id", id);

    if (error) {
      toast({
        title: "Error deleting tournament",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Tournament deleted",
        description: "The tournament has been removed",
      });
      navigate("/tournaments");
    }
  };

  const handleTogglePublicView = async (enabled: boolean) => {
    const { error } = await supabase
      .from("tournaments_events")
      .update({ public_view_enabled: enabled })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error updating public view",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: enabled ? "Public view enabled" : "Public view disabled",
        description: enabled 
          ? "Anyone with the link can now view live scores" 
          : "Public viewing has been disabled",
      });
      fetchTournament();
    }
  };

  const copyPublicUrl = () => {
    const url = `${window.location.origin}/tournament/${id}/live`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Public view URL copied to clipboard",
    });
  };

  const handleContinueToPayment = async () => {
    if (!tournament) return;

    if (divisions.length === 0) {
      toast({
        title: "Add divisions first",
        description: "Please add at least one division before checkout",
        variant: "destructive",
      });
      return;
    }
    
    setCheckoutLoading(true);
    try {
      const response = await supabase.functions.invoke("create-tournament-checkout", {
        body: { tournament_id: tournament.id },
      });

      if (response.error || response.data?.error) {
        const errorMessage = response.error?.message || response.data?.error || "Could not start payment process";
        throw new Error(errorMessage);
      }

      // Handle free access (no redirect needed)
      if (response.data?.free && response.data?.success) {
        toast({
          title: "Tournament activated!",
          description: "Your tournament is now live and ready for registrations.",
        });
        fetchTournament();
        return;
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
            paymentStatus={tournament.payment_status as "draft" | "pending" | "failed"}
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
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(true)} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{tournament.name}" and all associated data. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete Tournament
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>

          {tournament.description && (
            <p className="text-muted-foreground max-w-2xl">{tournament.description}</p>
          )}
        </motion.div>

        {/* Main Content */}
        {isPaid ? (
          <Tabs defaultValue="divisions" className="space-y-6">
            <TabsList className="bg-card/50 border border-border/50 p-1 flex-wrap h-auto">
              <TabsTrigger value="divisions" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Divisions</TabsTrigger>
              <TabsTrigger value="registrations" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Registrations</TabsTrigger>
              <TabsTrigger value="checkin" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Check-In</TabsTrigger>
              <TabsTrigger value="courts" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Courts</TabsTrigger>
              <TabsTrigger value="customize" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Customize</TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="divisions" className="space-y-4">
              <DivisionManager
                divisions={divisions}
                paidDivisionsCount={tournament.paid_divisions_count || 3}
                tournamentId={tournament.id}
                onAddDivision={async (division) => {
                  const { error } = await supabase.from("tournaments_divisions").insert({
                    event_id: tournament.id,
                    name: division.name,
                    skill_level: division.skill_level,
                    format: division.format,
                  });
                  if (!error) {
                    fetchTournament();
                    return true;
                  }
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  return false;
                }}
                onUpdateDivision={async (divId, updates) => {
                  const { error } = await supabase
                    .from("tournaments_divisions")
                    .update(updates)
                    .eq("id", divId);
                  if (!error) {
                    fetchTournament();
                    return true;
                  }
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  return false;
                }}
                onDeleteDivision={async (divId) => {
                  const { error } = await supabase
                    .from("tournaments_divisions")
                    .delete()
                    .eq("id", divId);
                  if (!error) {
                    fetchTournament();
                    return true;
                  }
                  toast({ title: "Error", description: error.message, variant: "destructive" });
                  return false;
                }}
                onRefresh={fetchTournament}
              />
            </TabsContent>

            <TabsContent value="registrations">
              <RegistrationsPanel eventId={id!} divisions={divisions} />
            </TabsContent>

            <TabsContent value="checkin">
              <CheckInDashboard eventId={id!} divisions={divisions} />
            </TabsContent>

            <TabsContent value="courts">
              <CourtManagementPanel eventId={id!} />
            </TabsContent>

            <TabsContent value="customize">
              <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" />
                    <CardTitle>Customize Public Landing Page</CardTitle>
                  </div>
                  <CardDescription>
                    Design a custom landing page for players to learn about your tournament before registering
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Create a beautiful, branded landing page featuring:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 ml-4 list-disc">
                      <li>Custom hero banner and tagline</li>
                      <li>Event description with rich text and images</li>
                      <li>Venue information and map</li>
                      <li>Sponsor logos and partner links</li>
                      <li>Tournament policies and contact details</li>
                    </ul>
                  </div>
                  <div className="pt-4 flex gap-3 flex-wrap">
                    <Button 
                      onClick={() => navigate(`/tournaments/${id}/customize`)}
                      size="lg"
                    >
                      <Palette className="mr-2 h-4 w-4" />
                      Open Customization Panel
                    </Button>
                    <Button 
                      variant="outline"
                      size="lg"
                      onClick={() => window.open(`/tournament/${id}`, '_blank')}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview Landing Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <TournamentHealthCard eventId={id!} divisionsCount={divisions.length} />

                {/* Registration Settings */}
                <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                  <CardHeader>
                    <CardTitle>Registration Settings</CardTitle>
                    <CardDescription>
                      Configure how players register for your tournament
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="registration-enabled">Enable Registration</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow players to register for this tournament
                        </p>
                      </div>
                      <Switch
                        id="registration-enabled"
                        checked={tournament.registration_enabled}
                        onCheckedChange={(checked) => handleUpdateTournament({ registration_enabled: checked })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="waitlist-enabled">Enable Waitlist</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow players to join a waitlist when divisions are full
                        </p>
                      </div>
                      <Switch
                        id="waitlist-enabled"
                        checked={tournament.waitlist_enabled}
                        onCheckedChange={(checked) => handleUpdateTournament({ waitlist_enabled: checked })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label htmlFor="reg-open-date">Registration Opens</Label>
                        <Input
                          id="reg-open-date"
                          type="date"
                          value={tournament.registration_open_date?.split('T')[0] || ''}
                          onChange={(e) => handleUpdateTournament({ 
                            registration_open_date: e.target.value || null 
                          })}
                          className="bg-card"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-close-date">Registration Closes</Label>
                        <Input
                          id="reg-close-date"
                          type="date"
                          value={tournament.registration_close_date?.split('T')[0] || ''}
                          onChange={(e) => handleUpdateTournament({ 
                            registration_close_date: e.target.value || null 
                          })}
                          className="bg-card"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-border/50">
                      <Label htmlFor="reg-fee">Registration Fee ($)</Label>
                      <Input
                        id="reg-fee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={tournament.registration_fee || 0}
                        onChange={(e) => handleUpdateTournament({ 
                          registration_fee: parseFloat(e.target.value) || 0 
                        })}
                        className="bg-card max-w-[200px]"
                      />
                      <p className="text-sm text-muted-foreground">
                        Fee charged per team registration
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                  <CardHeader>
                    <CardTitle>Public View</CardTitle>
                    <CardDescription>
                      Allow anyone with the link to view live scores and standings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="public-view">Enable Public View</Label>
                        <p className="text-sm text-muted-foreground">
                          When enabled, anyone can view live match scores and team standings
                        </p>
                      </div>
                      <Switch
                        id="public-view"
                        checked={tournament.public_view_enabled}
                        onCheckedChange={handleTogglePublicView}
                      />
                    </div>
                    
                    {tournament.public_view_enabled && (
                      <div className="pt-4 border-t border-border/50 space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-2">Public Live View URL</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              readOnly
                              value={`${window.location.origin}/tournament/${id}/live`}
                              className="flex-1 px-3 py-2 text-sm bg-muted rounded-md border border-border/50"
                            />
                            <Button variant="outline" size="sm" onClick={copyPublicUrl}>
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => window.open(`/tournament/${id}/live`, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
                  <CardHeader>
                    <CardTitle>Tournament Details</CardTitle>
                    <CardDescription>
                      View tournament information and metadata
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium">Status</p>
                        <p className="text-sm text-muted-foreground capitalize">{tournament.status}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Payment Status</p>
                        <p className="text-sm text-muted-foreground capitalize">{tournament.payment_status}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Division Slots</p>
                        <p className="text-sm text-muted-foreground">{divisions.length} of {tournament.paid_divisions_count} used</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tournament.created_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
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

      {tournament && (
        <EditTournamentDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          event={tournament}
          onSave={handleUpdateTournament}
        />
      )}
    </div>
  );
}
