import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Calendar, MapPin, Users, ChevronLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface Event {
  id: string;
  name: string;
  organizer_id: string;
  location: string | null;
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  num_courts: number | null;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    display_name: string | null;
  };
  match_count?: number;
}

const Events = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Fetch events
      const { data: eventsData, error } = await supabase
        .from("events")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching events:", error);
        toast.error("Failed to load events");
      } else {
        // Get match counts and organizer profiles for each event
        const eventsWithData = await Promise.all(
          (eventsData || []).map(async (event) => {
            const { count } = await supabase
              .from("matches")
              .select("*", { count: "exact", head: true })
              .eq("event_id", event.id);
            
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, display_name")
              .eq("id", event.organizer_id)
              .single();
            
            return { 
              ...event, 
              match_count: count || 0,
              profiles: profileData
            };
          })
        );
        
        setEvents(eventsWithData);
      }

      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const formatDate = (date: string | null) => {
    if (!date) return "TBD";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (time: string | null) => {
    if (!time) return "";
    return new Date(`2000-01-01T${time}`).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Events</h1>
            <p className="text-muted-foreground">
              Organize and track matches for pickup games, round robins, and tournaments
            </p>
          </div>
          <Button size="lg" onClick={() => navigate("/events/new")}>
            <Plus className="w-5 h-5 mr-2" />
            Create Event
          </Button>
        </div>

        {events.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">No events yet</p>
              <Button onClick={() => navigate("/events/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Event
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <Card
                key={event.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-start justify-between">
                    <span className="line-clamp-2">{event.name}</span>
                    {event.organizer_id === userId && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                        Organizer
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription>
                    by {event.profiles?.display_name || event.profiles?.full_name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4 mr-2" />
                    {formatDate(event.event_date)}
                    {event.start_time && ` • ${formatTime(event.start_time)}`}
                  </div>
                  {event.location && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4 mr-2" />
                      {event.location}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-2" />
                    {event.match_count || 0} matches
                  </div>
                  <div className="pt-2">
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        event.status === "active"
                          ? "bg-green-500/20 text-green-500"
                          : "bg-gray-500/20 text-gray-500"
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Events;
