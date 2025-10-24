import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, MessageSquare, Users, Eye, EyeOff, Bell, BellOff } from "lucide-react";
import { CourtChannel } from "@/components/court/CourtChannel";
import { LFGList } from "@/components/court/LFGList";
import { CreateLFGDialog } from "@/components/court/CreateLFGDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CourtPref {
  hidden_until: string | null;
  muted: boolean;
  favorite: boolean;
}

export default function CourtConnector() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [selectedCourtId, setSelectedCourtId] = useState<string>("");
  const [courtPrefs, setCourtPrefs] = useState<Map<string, CourtPref>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateLFG, setShowCreateLFG] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchCourtsAndPrefs();
    }
  }, [currentUserId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchCourtsAndPrefs = async () => {
    setLoading(true);

    // Fetch all courts
    const { data: courtsData, error: courtsError } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (courtsError) {
      toast({
        title: "Error",
        description: "Failed to load courts",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    // Fetch user preferences
    const { data: prefsData } = await (supabase as any)
      .from("user_court_prefs")
      .select("*")
      .eq("user_id", currentUserId!);

    const prefsMap = new Map<string, CourtPref>();
    prefsData?.forEach((pref) => {
      prefsMap.set(pref.court_id, {
        hidden_until: pref.hidden_until,
        muted: pref.muted || false,
        favorite: pref.favorite || false,
      });
    });
    setCourtPrefs(prefsMap);

    // Filter out hidden courts
    const visibleCourts = courtsData?.filter((court) => {
      const pref = prefsMap.get(court.id);
      if (!pref?.hidden_until) return true;
      return new Date(pref.hidden_until) <= new Date();
    }) || [];

    setCourts(visibleCourts);

    // Get user's home court or select first available
    if (visibleCourts.length > 0) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("home_court_id")
        .eq("id", currentUserId!)
        .single();

      if (profile?.home_court_id && visibleCourts.some(c => c.id === profile.home_court_id)) {
        setSelectedCourtId(profile.home_court_id);
      } else {
        setSelectedCourtId(visibleCourts[0].id);
      }
    }

    setLoading(false);
  };

  const handleHideCourt = async (courtId: string, duration: 'indefinite' | '7' | '30' | '90') => {
    if (!currentUserId) return;

    let hiddenUntil: string | null = null;
    if (duration !== 'indefinite') {
      const days = parseInt(duration);
      const date = new Date();
      date.setDate(date.getDate() + days);
      hiddenUntil = date.toISOString();
    }

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert({
        user_id: currentUserId,
        court_id: courtId,
        hidden_until: hiddenUntil,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to hide court",
        variant: "destructive",
      });
    } else {
      const courtName = courts.find(c => c.id === courtId)?.name;
      toast({
        title: "Court Hidden",
        description: `${courtName} has been hidden${duration !== 'indefinite' ? ` for ${duration} days` : ''}`,
      });
      fetchCourtsAndPrefs();
    }
  };

  const handleToggleMute = async (courtId: string) => {
    if (!currentUserId) return;

    const currentPref = courtPrefs.get(courtId);
    const newMuted = !(currentPref?.muted || false);

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert({
        user_id: currentUserId,
        court_id: courtId,
        muted: newMuted,
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update notifications",
        variant: "destructive",
      });
    } else {
      toast({
        title: newMuted ? "Notifications Muted" : "Notifications Enabled",
        description: `You will ${newMuted ? 'not' : ''} receive notifications for this court`,
      });
      fetchCourtsAndPrefs();
    }
  };

  const selectedCourt = courts.find(c => c.id === selectedCourtId);
  const selectedPref = courtPrefs.get(selectedCourtId);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">Court Connector</h1>
            <p className="text-muted-foreground">Find players, chat, and organize games</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/settings/courts")} variant="outline" size="sm">
              Court Settings
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Select value={selectedCourtId} onValueChange={setSelectedCourtId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name} - {court.city}, {court.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCourtId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <Users className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleToggleMute(selectedCourtId)}>
                      {selectedPref?.muted ? (
                        <>
                          <Bell className="w-4 h-4 mr-2" />
                          Enable Notifications
                        </>
                      ) : (
                        <>
                          <BellOff className="w-4 h-4 mr-2" />
                          Mute Notifications
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleHideCourt(selectedCourtId, '7')}>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide for 7 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleHideCourt(selectedCourtId, '30')}>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide for 30 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleHideCourt(selectedCourtId, 'indefinite')}>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide indefinitely
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : selectedCourtId ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Looking for Game (LFG)
                  </CardTitle>
                  <Button onClick={() => setShowCreateLFG(true)}>
                    Post LFG
                  </Button>
                </CardHeader>
                <CardContent>
                  <LFGList courtId={selectedCourtId} userId={currentUserId} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Court Channel
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CourtChannel courtId={selectedCourtId} userId={currentUserId} />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Court Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="font-semibold">{selectedCourt?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedCourt?.city}, {selectedCourt?.state}
                    </p>
                  </div>
                  {selectedPref?.muted && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BellOff className="w-4 h-4" />
                      Notifications muted
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">No courts available. Please check back later.</p>
            </CardContent>
          </Card>
        )}

        {showCreateLFG && selectedCourtId && (
          <CreateLFGDialog
            courtId={selectedCourtId}
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
