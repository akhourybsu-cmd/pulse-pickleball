import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function QRCheckIn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session");
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (sessionId) {
        await fetchSession();
        if (user) {
          await checkIfAlreadyCheckedIn();
        }
      } else {
        // No session ID provided
        toast({
          title: "Invalid Link",
          description: "No session ID provided",
          variant: "destructive",
        });
        setLoading(false);
      }
    };
    
    initPage();
  }, [sessionId]);

  const fetchSession = async () => {
    if (!sessionId) return;

    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        courts:court_id (name, location)
      `)
      .eq("id", sessionId)
      .eq("status", "active")
      .single();

    if (error) {
      console.error("Error fetching session:", error);
      toast({
        title: "Session Not Found",
        description: "This session may have ended or the link is invalid",
        variant: "destructive",
      });
      return;
    }

    setSession(data);
    setLoading(false);
  };

  const checkIfAlreadyCheckedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !sessionId) return;

    const { data } = await supabase
      .from("check_ins")
      .select("id")
      .eq("session_id", sessionId)
      .eq("player_id", user.id)
      .eq("status", "active")
      .single();

    if (data) {
      setCheckedIn(true);
    }
  };

  const handleCheckIn = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Redirect to auth with return URL
      navigate(`/auth?redirect=/qr-checkin?session=${sessionId}`);
      return;
    }

    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from("check_ins")
        .insert({
          session_id: sessionId,
          player_id: user.id,
          status: "active",
        });

      if (error) throw error;

      setCheckedIn(true);
      
      toast({
        title: "Checked In! ✅",
        description: "You're now checked in to the session",
      });

      // Redirect to session queue after 2 seconds
      setTimeout(() => {
        navigate(`/session/queue?session=${sessionId}`);
      }, 2000);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <p className="text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Session Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              This session may have ended or the link is invalid.
            </p>
            <Button onClick={() => navigate("/dashboard")}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{session.name}</CardTitle>
          <p className="text-sm text-muted-foreground mt-2">
            {session.courts.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(`2000-01-01T${session.start_time}`).toLocaleTimeString([], { 
              hour: 'numeric', 
              minute: '2-digit' 
            })}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {checkedIn ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <div>
                <p className="font-semibold text-lg">You're Checked In!</p>
                <p className="text-sm text-muted-foreground">
                  Redirecting to session queue...
                </p>
              </div>
              <Button 
                onClick={() => navigate(`/session/queue?session=${sessionId}`)} 
                className="w-full"
              >
                Go to Queue Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-muted-foreground">
                Tap below to check in and join the queue
              </p>
              <Button 
                onClick={handleCheckIn} 
                size="lg" 
                className="w-full"
              >
                Check In Now
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
