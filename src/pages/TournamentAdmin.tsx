import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateTournamentDialog } from "@/components/tournament/CreateTournamentDialog";
import { format } from "date-fns";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import logo from "@/assets/pulse-logo-premium.svg";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: "draft" | "upcoming" | "live" | "completed" | "cancelled";
  created_at: string;
}

export default function TournamentAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to access this page",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!(await isPlatformAdmin(user.id))) {
      toast({
        title: "Access denied",
        description: "Admin privileges required for Tournament Portal",
        variant: "destructive",
      });
      navigate("/dashboard");
      return;
    }

    fetchEvents();
  };

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournaments_events")
      .select("*")
      .order("start_date", { ascending: false });

    if (error) {
      toast({
        title: "Error loading events",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setEvents(data || []);
    }
    setLoading(false);
  };

  const handleCreateEvent = async (eventData: Omit<TournamentEvent, "id" | "created_at">) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("tournaments_events")
      .insert({
        ...eventData,
        created_by: user.id,
      });

    if (error) {
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Event created",
        description: `${eventData.name} has been created successfully`,
      });
      setIsCreateDialogOpen(false);
      fetchEvents();
    }
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Tournament Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/admin-dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">Tournament Portal</h1>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Tournament Events</h2>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
            <Plus className="mr-2 h-5 w-5" />
            Create Event
          </Button>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No events yet</CardTitle>
              <CardDescription>
                Create your first tournament event to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/tournament-admin/event/${event.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{event.name}</CardTitle>
                    {getStatusBadge(event.status)}
                  </div>
                  <CardDescription>
                    {event.location && <span className="block">{event.location}</span>}
                    <span className="block mt-1">
                      {format(new Date(event.start_date), "MMM d")} - {format(new Date(event.end_date), "MMM d, yyyy")}
                    </span>
                  </CardDescription>
                </CardHeader>
                {event.description && (
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {event.description}
                    </p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}

        <CreateTournamentDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onSubmit={handleCreateEvent}
        />
      </div>

      <Footer />
    </div>
  );
}
