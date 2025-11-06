import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, MapPin, Users, Trash2, Clock, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { BackToDashboard } from "@/components/BackToDashboard";

interface TournamentRegistration {
  id: string;
  team_name: string;
  status: string;
  payment_status: string;
  registration_date: string;
  event: {
    id: string;
    name: string;
    location: string | null;
    start_date: string;
    end_date: string;
  };
  division: {
    id: string;
    name: string;
    format: string;
  };
  partner: {
    id: string;
    display_name: string;
  } | null;
}

interface RoundRobinRegistration {
  id: string;
  event_id: string;
  registration_status: string;
  joined_at: string;
  event: {
    id: string;
    name: string;
    date: string;
    location: string | null;
    max_players: number;
    status: string;
  };
}

interface CalendarEventRegistration {
  id: string;
  event_id: string;
  registered_at: string;
  status: string;
  event: {
    id: string;
    title: string;
    start_time: string;
    end_time: string;
    event_type: string;
    instructor: string | null;
    skill_level: string | null;
    capacity: number;
    price: number;
  };
}

type Registration = (TournamentRegistration & { type: 'tournament' }) | (RoundRobinRegistration & { type: 'round_robin' });

export default function MyRegistrations() {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth?redirect=/my-registrations");
        return;
      }

      // Fetch tournament registrations
      const { data: tournamentData, error: tournamentError } = await supabase
        .from("tournament_registrations")
        .select(`
          id,
          team_name,
          status,
          payment_status,
          registration_date,
          event:tournaments_events(id, name, location, start_date, end_date),
          division:tournaments_divisions(id, name, format),
          partner:partner_user_id(id, display_name)
        `)
        .or(`captain_user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
        .order("registration_date", { ascending: false });

      if (tournamentError) throw tournamentError;

      // Fetch round robin registrations
      const { data: roundRobinData, error: roundRobinError } = await supabase
        .from("round_robin_players")
        .select(`
          id,
          event_id,
          registration_status,
          joined_at,
          event:round_robin_events(id, name, date, location, max_players, status)
        `)
        .eq("player_id", user.id)
        .eq("active", true)
        .order("joined_at", { ascending: false });

      if (roundRobinError) throw roundRobinError;

      // Fetch calendar event registrations
      const { data: calendarData, error: calendarError } = await supabase
        .from("calendar_event_registrations")
        .select(`
          id,
          event_id,
          registered_at,
          status,
          event:calendar_events(id, title, start_time, end_time, event_type, instructor, skill_level, capacity, price)
        `)
        .eq("user_id", user.id)
        .order("registered_at", { ascending: false });

      if (calendarError) throw calendarError;

      // Combine and sort all registrations
      const allRegistrations = [
        ...(tournamentData || []).map((reg: any) => ({ ...reg, type: 'tournament' })),
        ...(roundRobinData || []).map((reg: any) => ({ ...reg, type: 'round_robin' })),
        ...(calendarData || []).map((reg: any) => ({ ...reg, type: 'calendar' }))
      ];

      // Sort by date (most recent first)
      allRegistrations.sort((a: any, b: any) => {
        const dateA = a.type === 'tournament' ? new Date(a.registration_date) : 
                      a.type === 'round_robin' ? new Date(a.joined_at) :
                      new Date(a.registered_at);
        const dateB = b.type === 'tournament' ? new Date(b.registration_date) : 
                      b.type === 'round_robin' ? new Date(b.joined_at) :
                      new Date(b.registered_at);
        return dateB.getTime() - dateA.getTime();
      });

      setRegistrations(allRegistrations);
    } catch (error: any) {
      toast({
        title: "Error loading registrations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRegistration = async (registrationId: string) => {
    try {
      const { error } = await supabase
        .from("tournament_registrations")
        .update({ status: "cancelled" })
        .eq("id", registrationId);

      if (error) throw error;

      toast({
        title: "Registration cancelled",
        description: "Your registration has been cancelled successfully.",
      });

      fetchRegistrations();
    } catch (error: any) {
      toast({
        title: "Error cancelling registration",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "secondary";
      case "waitlisted":
        return "outline";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "unpaid":
        return "secondary";
      case "refunded":
        return "outline";
      default:
        return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="container max-w-6xl py-8">
        <BackToDashboard />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading your registrations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <BackToDashboard />
      
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">My Registrations</h1>
        <p className="text-muted-foreground">
          View and manage all your event registrations (tournaments, round robins, lessons, open play, etc.)
        </p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven't registered for any events yet
            </p>
            <Button onClick={() => navigate("/browse-events")}>
              Browse Events
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {registrations.map((reg: any) => {
            if (reg.type === 'round_robin') {
              const rrReg = reg;
              return (
                <Card key={rrReg.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">
                          {rrReg.event.name}
                        </CardTitle>
                        <CardDescription>
                          Round Robin Event
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">Round Robin</Badge>
                        <Badge variant={rrReg.registration_status === 'confirmed' ? 'default' : 'secondary'}>
                          {rrReg.registration_status.charAt(0).toUpperCase() + rrReg.registration_status.slice(1)}
                        </Badge>
                        {rrReg.event.status && (
                          <Badge variant={
                            rrReg.event.status === 'completed' ? 'outline' : 
                            rrReg.event.status === 'live' ? 'default' : 'secondary'
                          }>
                            {rrReg.event.status.charAt(0).toUpperCase() + rrReg.event.status.slice(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(rrReg.event.date), "MMM d, yyyy")}
                        </span>
                      </div>
                      {rrReg.event.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{rrReg.event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Max Players: {rrReg.event.max_players}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Joined {format(new Date(rrReg.joined_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/round-robin/${rrReg.event.id}`)}
                      >
                        View Event
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            } else if (reg.type === 'calendar') {
              const calReg = reg;
              const EVENT_TYPE_LABELS: Record<string, string> = {
                'open_play': 'Open Play',
                'lesson': 'Lesson',
                'private': 'Private Event',
                'league': 'League',
                'tournament': 'Tournament'
              };
              
              return (
                <Card key={calReg.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">
                          {calReg.event.title}
                        </CardTitle>
                        <CardDescription>
                          {EVENT_TYPE_LABELS[calReg.event.event_type] || calReg.event.event_type}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">Calendar Event</Badge>
                        <Badge variant={calReg.status === 'confirmed' ? 'default' : 'secondary'}>
                          {calReg.status.charAt(0).toUpperCase() + calReg.status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(calReg.event.start_time), "MMM d, yyyy")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(calReg.event.start_time), "h:mm a")} - {format(new Date(calReg.event.end_time), "h:mm a")}
                        </span>
                      </div>
                      {calReg.event.instructor && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Instructor: {calReg.event.instructor}</span>
                        </div>
                      )}
                      {calReg.event.skill_level && (
                        <div className="flex items-center gap-2 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>Skill Level: {calReg.event.skill_level}</span>
                        </div>
                      )}
                      {calReg.event.price > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>${calReg.event.price}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Registered {format(new Date(calReg.registered_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/reservations`)}
                      >
                        View Calendar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            } else {
              const tournamentReg = reg;
              return (
                <Card key={tournamentReg.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-1">
                          {tournamentReg.event.name}
                        </CardTitle>
                        <CardDescription>
                          {tournamentReg.division.name} • {tournamentReg.division.format}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">Tournament</Badge>
                        <Badge variant={getStatusColor(tournamentReg.status)}>
                          {tournamentReg.status.charAt(0).toUpperCase() + tournamentReg.status.slice(1)}
                        </Badge>
                        <Badge variant={getPaymentStatusColor(tournamentReg.payment_status)}>
                          {tournamentReg.payment_status.charAt(0).toUpperCase() + tournamentReg.payment_status.slice(1)}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{tournamentReg.team_name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Partner: {tournamentReg.partner?.display_name || "TBD"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {format(new Date(tournamentReg.event.start_date), "MMM d")} -{" "}
                          {format(new Date(tournamentReg.event.end_date), "MMM d, yyyy")}
                        </span>
                      </div>
                      {tournamentReg.event.location && (
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span>{tournamentReg.event.location}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/tournament/${tournamentReg.event.id}/live`)}
                      >
                        View Event
                      </Button>
                      
                      {tournamentReg.status === "pending" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Registration?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will cancel your registration for {tournamentReg.event.name}. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Registration</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelRegistration(tournamentReg.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Cancel Registration
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
