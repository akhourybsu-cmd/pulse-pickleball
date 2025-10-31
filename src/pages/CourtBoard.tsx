import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ArrowLeft, MapPin, Users, Calendar, MessageSquare, Activity } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/court/connector")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <ThemeToggle />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold">{court.name}</h1>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{court.city}, {court.state}</span>
              </div>
              {court.location && (
                <p className="text-sm text-muted-foreground">{court.location}</p>
              )}
            </div>
            <CourtCheckIn courtId={court.id} userId={currentUserId} />
          </div>

          {channelId && (
            <Card>
              <CardContent className="pt-6">
                <CourtPresence courtId={court.id} channelId={channelId} />
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="lfg" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="lfg" className="gap-2">
              <Users className="w-4 h-4" />
              Looking for Game
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Court Chat
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-2">
              <Activity className="w-4 h-4" />
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lfg" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowCreateLFG(true)}>
                Post LFG
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <LFGList courtId={court.id} userId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            <Card>
              <CardContent className="pt-6">
                <CourtChannel courtId={court.id} userId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-4">
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
