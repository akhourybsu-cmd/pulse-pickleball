import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  registration_fee: number;
  divisions: {
    id: string;
    name: string;
    format: string;
    max_teams: number | null;
    _count: { teams: number; registrations: number };
  }[];
}

export default function Tournaments() {
  const [events, setEvents] = useState<TournamentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    checkUser();
    fetchOpenTournaments();
  }, []);

  const fetchOpenTournaments = async () => {
    try {
      const now = new Date().toISOString();

      // Fetch events that are open for registration
      const { data: eventsData, error: eventsError } = await supabase
        .from("tournaments_events")
        .select("*")
        .eq("public_view_enabled", true)
        .eq("registration_enabled", true)
        .or(`registration_close_date.is.null,registration_close_date.gte.${now}`)
        .in("status", ["draft", "upcoming", "live"])
        .order("start_date", { ascending: true });

      if (eventsError) throw eventsError;

      // For each event, fetch divisions with team and registration counts
      const eventsWithDivisions = await Promise.all(
        (eventsData || []).map(async (event) => {
          const { data: divisions, error: divisionsError } = await supabase
            .from("tournaments_divisions")
            .select("id, name, format, max_teams")
            .eq("event_id", event.id);

          if (divisionsError) throw divisionsError;

          // Get counts for each division
          const divisionsWithCounts = await Promise.all(
            (divisions || []).map(async (division) => {
              const { count: teamsCount } = await supabase
                .from("tournaments_teams")
                .select("*", { count: "exact", head: true })
                .eq("division_id", division.id);

              const { count: registrationsCount } = await supabase
                .from("tournament_registrations")
                .select("*", { count: "exact", head: true })
                .eq("division_id", division.id)
                .in("status", ["confirmed", "pending"]);

              return {
                ...division,
                _count: {
                  teams: teamsCount || 0,
                  registrations: registrationsCount || 0,
                },
              };
            })
          );

          return {
            ...event,
            divisions: divisionsWithCounts,
          };
        })
      );

      setEvents(eventsWithDivisions);
    } catch (error: any) {
      toast({
        title: "Error loading tournaments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTotalSpotsRemaining = (event: TournamentEvent) => {
    return event.divisions.reduce((total, div) => {
      const maxTeams = div.max_teams || 999;
      const currentTeams = div._count.teams + div._count.registrations;
      const remaining = Math.max(0, maxTeams - currentTeams);
      return total + remaining;
    }, 0);
  };

  const getRegistrationStatus = (event: TournamentEvent) => {
    const now = new Date();
    const openDate = event.registration_open_date ? new Date(event.registration_open_date) : null;
    const closeDate = event.registration_close_date ? new Date(event.registration_close_date) : null;

    if (openDate && now < openDate) {
      return { status: "upcoming", label: `Opens ${format(openDate, "MMM d")}` };
    }
    if (closeDate && now > closeDate) {
      return { status: "closed", label: "Registration closed" };
    }
    if (closeDate) {
      const daysRemaining = Math.ceil((closeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { status: "open", label: `Closes in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}` };
    }
    return { status: "open", label: "Open" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader userId={userId} />
        <div className="container max-w-6xl py-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading tournaments...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader userId={userId} />
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Open Tournaments</h1>
          <p className="text-muted-foreground">
            Register your team for upcoming tournaments
          </p>
        </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              No tournaments currently open for registration
            </p>
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {events.map((event) => {
            const regStatus = getRegistrationStatus(event);
            const spotsRemaining = getTotalSpotsRemaining(event);

            return (
              <Card key={event.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{event.name}</CardTitle>
                      {event.description && (
                        <CardDescription className="text-base">
                          {event.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge
                      variant={regStatus.status === "open" ? "default" : "secondary"}
                      className="ml-4"
                    >
                      {regStatus.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(event.start_date), "MMM d")} -{" "}
                        {format(new Date(event.end_date), "MMM d, yyyy")}
                      </span>
                    </div>
                    {event.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{event.location}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {event.divisions.length} division{event.divisions.length !== 1 ? "s" : ""} •{" "}
                        {spotsRemaining} spot{spotsRemaining !== 1 ? "s" : ""} left
                      </span>
                    </div>
                    {event.registration_fee > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>${event.registration_fee.toFixed(2)} per team</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {event.divisions.slice(0, 3).map((div) => (
                        <Badge key={div.id} variant="outline">
                          {div.name}
                        </Badge>
                      ))}
                      {event.divisions.length > 3 && (
                        <Badge variant="outline">+{event.divisions.length - 3} more</Badge>
                      )}
                    </div>

                    <Button
                      onClick={() => navigate(`/tournament/${event.id}/register`)}
                      disabled={regStatus.status !== "open" || spotsRemaining === 0}
                    >
                      {spotsRemaining === 0 ? "Full" : "Register Team"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
