import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar, MapPin, Users, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { BackToDashboard } from "@/components/BackToDashboard";

interface Registration {
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

export default function MyRegistrations() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
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

      const { data, error } = await supabase
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

      if (error) throw error;
      setRegistrations(data as any || []);
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
        <h1 className="text-4xl font-bold mb-2">My Tournament Registrations</h1>
        <p className="text-muted-foreground">
          View and manage your tournament registrations
        </p>
      </div>

      {registrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">
              You haven't registered for any tournaments yet
            </p>
            <Button onClick={() => navigate("/tournaments")}>
              Browse Tournaments
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {registrations.map((reg) => (
            <Card key={reg.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-xl mb-1">
                      {reg.event.name}
                    </CardTitle>
                    <CardDescription>
                      {reg.division.name} • {reg.division.format}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={getStatusColor(reg.status)}>
                      {reg.status.charAt(0).toUpperCase() + reg.status.slice(1)}
                    </Badge>
                    <Badge variant={getPaymentStatusColor(reg.payment_status)}>
                      {reg.payment_status.charAt(0).toUpperCase() + reg.payment_status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{reg.team_name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>
                      Partner: {reg.partner?.display_name || "TBD"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {format(new Date(reg.event.start_date), "MMM d")} -{" "}
                      {format(new Date(reg.event.end_date), "MMM d, yyyy")}
                    </span>
                  </div>
                  {reg.event.location && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{reg.event.location}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/tournament/${reg.event.id}/live`)}
                  >
                    View Event
                  </Button>
                  
                  {reg.status === "pending" && (
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
                            This will cancel your registration for {reg.event.name}. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep Registration</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleCancelRegistration(reg.id)}
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
          ))}
        </div>
      )}
    </div>
  );
}
