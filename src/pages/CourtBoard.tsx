import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CourtHeatmap } from "@/components/court/CourtHeatmap";
import { CourtAnalytics } from "@/components/court/CourtAnalytics";
import { CourtPresence } from "@/components/court/CourtPresence";
import { CourtCheckIn } from "@/components/court/CourtCheckIn";
import { LFGList } from "@/components/court/LFGList";
import { CourtChannel } from "@/components/court/CourtChannel";
import { CreateLFGDialog } from "@/components/court/CreateLFGDialog";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Users, MessageSquare, Activity, LogOut, User as UserIcon } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
  location: string;
}

export default function CourtBoard() {
  const { courtId } = useParams<{ courtId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [court, setCourt] = useState<Court | null>(null);
  const [channelId, setChannelId] = useState<string>("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateLFG, setShowCreateLFG] = useState(false);

  useEffect(() => {
    checkUser();
    if (courtId) {
      fetchCourt();
      fetchChannel();
    }
  }, [courtId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchCourt = async () => {
    const { data, error } = await supabase
      .from("courts")
      .select("*")
      .eq("id", courtId)
      .maybeSingle();

    if (error || !data) {
      toast({
        title: "Error",
        description: "Failed to load court",
        variant: "destructive",
      });
      navigate("/court/connector");
    } else {
      setCourt(data);
    }
    setLoading(false);
  };

  const fetchChannel = async () => {
    const { data } = await (supabase as any)
      .from("court_channels")
      .select("id")
      .eq("court_id", courtId)
      .maybeSingle();

    if (data) {
      setChannelId(data.id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!court) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/profile/${currentUserId}`)} 
              className="rounded-full"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">View Profile</span>
            </Button>
            <ThemeToggle />
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-6 space-y-6">

        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3">
            <div className="space-y-1 sm:space-y-2 flex-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold break-words">{court.name}</h1>
              <div className="flex items-center gap-1 sm:gap-2 text-muted-foreground text-sm sm:text-base">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="break-words">{court.city}, {court.state}</span>
              </div>
              {court.location && (
                <p className="text-xs sm:text-sm text-muted-foreground break-words">{court.location}</p>
              )}
            </div>
            <div className="w-full sm:w-auto">
              <CourtCheckIn courtId={court.id} userId={currentUserId} />
            </div>
          </div>

          {channelId && (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <CourtPresence courtId={court.id} channelId={channelId} />
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="lfg" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="lfg" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Looking for Game</span>
              <span className="sm:hidden">LFG</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Court Chat</span>
              <span className="sm:hidden">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Insights</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lfg" className="space-y-3 sm:space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateLFG(true)} className="w-full sm:w-auto">
                Post LFG
              </Button>
            </div>
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <LFGList courtId={court.id} userId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-0 sm:px-6">
                <CourtChannel courtId={court.id} userId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-3 sm:space-y-4">
            <CourtAnalytics courtId={court.id} />
            <CourtHeatmap courtId={court.id} />
          </TabsContent>
        </Tabs>

        {showCreateLFG && (
          <CreateLFGDialog
            courtId={court.id}
            userId={currentUserId}
            onClose={() => setShowCreateLFG(false)}
            onSuccess={() => {
              setShowCreateLFG(false);
              toast({
                title: "LFG Posted",
                description: "Your looking for game post has been created",
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
