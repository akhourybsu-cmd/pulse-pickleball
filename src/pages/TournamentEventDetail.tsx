import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Edit, Trash2, Plus, ChevronRight, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { EditTournamentDialog } from "@/components/tournament/EditTournamentDialog";
import { CreateDivisionDialog } from "@/components/tournament/CreateDivisionDialog";
import { CourtManagementPanel } from "@/components/tournament/CourtManagementPanel";
import { RegistrationsPanel } from "@/components/tournament/RegistrationsPanel";
import { format } from "date-fns";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled";
  created_at: string;
  public_view_enabled: boolean;
}

interface Division {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  format: string;
  scoring_ruleset_id: string | null;
  max_teams: number | null;
  created_at: string;
  updated_at: string;
  tournaments_scoring_rulesets?: {
    name: string;
    games_to: number;
    win_by_2: boolean;
    best_of: number;
  };
}

export default function TournamentEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDivisionOpen, setIsCreateDivisionOpen] = useState(false);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchDivisions();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (error) {
      toast({
        title: "Error loading event",
        description: error.message,
        variant: "destructive",
      });
      navigate("/tournament-admin");
    } else {
      setEvent(data);
    }
    setLoading(false);
  };

  const fetchDivisions = async () => {
    const { data, error } = await supabase
      .from("tournaments_divisions")
      .select(`
        *,
        tournaments_scoring_rulesets (
          name,
          games_to,
          win_by_2,
          best_of
        )
      `)
      .eq("event_id", eventId)
      .order("name");

    if (error) {
      toast({
        title: "Error loading divisions",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setDivisions(data || []);
    }
  };

  const handleUpdateEvent = async (updates: Partial<TournamentEvent>) => {
    const { error } = await supabase
      .from("tournaments_events")
      .update(updates)
      .eq("id", eventId);

    if (error) {
      toast({
        title: "Error updating event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event updated",
        description: "Changes saved successfully",
      });
      fetchEvent();
    }
  };

  const handleDeleteEvent = async () => {
    const { error } = await supabase
      .from("tournaments_events")
      .delete()
      .eq("id", eventId);

    if (error) {
      toast({
        title: "Error deleting event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event deleted",
        description: "The tournament event has been removed",
      });
      navigate("/tournament-admin");
    }
  };

  const handleTogglePublicView = async (enabled: boolean) => {
    const { error } = await supabase
      .from("tournaments_events")
      .update({ public_view_enabled: enabled })
      .eq("id", eventId);

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
      fetchEvent();
    }
  };

  const copyPublicUrl = () => {
    const url = `${window.location.origin}/tournament/${eventId}/live`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Public view URL copied to clipboard",
    });
  };

  const getStatusBadge = (status: TournamentEvent["status"]) => {
    const variants: Record<typeof status, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      upcoming: "secondary",
      live: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status]}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/tournament-admin">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">{event.name}</h1>
            {getStatusBadge(event.status)}
          </div>
          <p className="text-lg text-muted-foreground">
            {event.location && <span>{event.location} • </span>}
            {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
          </p>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(true)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Tournament Event?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{event.name}" and all associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteEvent} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Event
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {event.description && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="divisions" className="w-full">
          <TabsList>
            <TabsTrigger value="divisions">Divisions</TabsTrigger>
            <TabsTrigger value="registrations">Registrations</TabsTrigger>
            <TabsTrigger value="courts">Courts</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="divisions" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Divisions ({divisions.length})</CardTitle>
                  <CardDescription>
                    Manage tournament divisions and round-robin groups
                  </CardDescription>
                </div>
                <Button onClick={() => setIsCreateDivisionOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Division
                </Button>
              </CardHeader>
              <CardContent>
                {divisions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      No divisions created yet
                    </p>
                    <Button onClick={() => setIsCreateDivisionOpen(true)} variant="outline">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Division
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {divisions.map((division) => (
                      <Card 
                        key={division.id}
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => navigate(`/tournament-admin/division/${division.id}`)}
                      >
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <CardTitle className="text-xl flex items-center gap-2">
                                {division.name}
                                <ChevronRight className="h-5 w-5 text-muted-foreground" />
                              </CardTitle>
                              {division.description && (
                                <CardDescription className="mt-2">
                                  {division.description}
                                </CardDescription>
                              )}
                            </div>
                            <Badge variant="secondary" className="capitalize">
                              {division.format.replace("_", " ")}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="font-medium">Scoring</p>
                              <p className="text-muted-foreground">
                                {division.tournaments_scoring_rulesets?.name || "Not set"}
                              </p>
                            </div>
                            {division.max_teams && (
                              <div>
                                <p className="font-medium">Max Teams</p>
                                <p className="text-muted-foreground">{division.max_teams}</p>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="registrations" className="mt-6">
            <RegistrationsPanel eventId={eventId!} divisions={divisions} />
          </TabsContent>

          <TabsContent value="courts" className="mt-6">
            <CourtManagementPanel eventId={eventId!} />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <div className="space-y-6">
              <Card>
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
                      checked={event.public_view_enabled}
                      onCheckedChange={handleTogglePublicView}
                    />
                  </div>
                  
                  {event.public_view_enabled && (
                    <div className="pt-4 border-t space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Public Live View URL</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/tournament/${eventId}/live`}
                            className="flex-1 px-3 py-2 text-sm bg-muted rounded-md"
                          />
                          <Button variant="outline" size="sm" onClick={copyPublicUrl}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(`/tournament/${eventId}/live`, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Event Settings</CardTitle>
                  <CardDescription>
                    Configure tournament parameters and rules
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-sm text-muted-foreground capitalize">{event.status}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.created_at), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {event && (
        <>
          <EditTournamentDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            event={event}
            onSave={handleUpdateEvent}
          />
          <CreateDivisionDialog
            open={isCreateDivisionOpen}
            onOpenChange={setIsCreateDivisionOpen}
            eventId={event.id}
            onSuccess={fetchDivisions}
          />
        </>
      )}
    </div>
  );
}
