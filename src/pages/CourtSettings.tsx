import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Eye, Bell, BellOff, Star } from "lucide-react";
import { formatDateEST } from "@/lib/utils";
import { AvailabilitySettings } from "@/components/court/AvailabilitySettings";
import { User } from "lucide-react";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CourtPref {
  court_id: string;
  hidden_until: string | null;
  muted: boolean;
  favorite: boolean;
  home: boolean;
}

export default function CourtSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<Court[]>([]);
  const [prefs, setPrefs] = useState<Map<string, CourtPref>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchData();
    }
  }, [currentUserId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchData = async () => {
    setLoading(true);

    // Fetch all courts
    const { data: courtsData } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    // Fetch user preferences
    const { data: prefsData } = await (supabase as any)
      .from("user_court_prefs")
      .select("*")
      .eq("user_id", currentUserId!);

    const prefsMap = new Map<string, CourtPref>();
    prefsData?.forEach((pref: CourtPref) => {
      prefsMap.set(pref.court_id, pref);
    });

    setCourts(courtsData || []);
    setPrefs(prefsMap);
    setLoading(false);
  };

  const handleUnhide = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert({
        user_id: currentUserId,
        court_id: courtId,
        hidden_until: null,
      });

    if (!error) {
      toast({
        title: "Court Unhidden",
        description: "Court is now visible in your lists",
      });
      fetchData();
    }
  };

  const handleToggleMute = async (courtId: string) => {
    if (!currentUserId) return;

    const currentPref = prefs.get(courtId);
    const newMuted = !(currentPref?.muted || false);

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert({
        user_id: currentUserId,
        court_id: courtId,
        muted: newMuted,
      });

    if (!error) {
      toast({
        title: newMuted ? "Notifications Muted" : "Notifications Enabled",
      });
      fetchData();
    }
  };

  const handleToggleFavorite = async (courtId: string) => {
    if (!currentUserId) return;

    const currentPref = prefs.get(courtId);
    const newFavorite = !(currentPref?.favorite || false);

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert({
        user_id: currentUserId,
        court_id: courtId,
        favorite: newFavorite,
      });

    if (!error) {
      toast({
        title: newFavorite ? "Added to Favorites" : "Removed from Favorites",
      });
      fetchData();
    }
  };

  const isHidden = (courtId: string) => {
    const pref = prefs.get(courtId);
    if (!pref?.hidden_until) return false;
    return new Date(pref.hidden_until) > new Date();
  };

  const hiddenCourts = courts.filter(c => isHidden(c.id));
  const visibleCourts = courts.filter(c => !isHidden(c.id));

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/player/community")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Community
          </Button>
          <ThemeToggle />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold">Court Settings</h1>
          <p className="text-muted-foreground">Manage your court preferences and visibility</p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Availability Settings */}
            <AvailabilitySettings />
            
            {/* Court Preferences Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Court Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Set your availability to get personalized recommendations for games at your preferred times.
                  Smart Match will suggest LFG posts that match your skill level and schedule.
                </p>
                <Button variant="outline" onClick={() => navigate("/profile/edit")}>
                  Edit Profile & Preferences
                </Button>
              </CardContent>
            </Card>
            
            {/* Visible Courts */}
            <Card>
              <CardHeader>
                <CardTitle>My Courts ({visibleCourts.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {visibleCourts.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    All courts are hidden. Unhide some courts below to see them here.
                  </p>
                ) : (
                  visibleCourts.map((court) => {
                    const pref = prefs.get(court.id);
                    return (
                      <div
                        key={court.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{court.name}</p>
                            {pref?.favorite && (
                              <Star className="w-4 h-4 fill-primary text-primary" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {court.city}, {court.state}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleFavorite(court.id)}
                          >
                            <Star
                              className={`w-4 h-4 ${
                                pref?.favorite ? "fill-primary text-primary" : ""
                              }`}
                            />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleMute(court.id)}
                          >
                            {pref?.muted ? (
                              <BellOff className="w-4 h-4" />
                            ) : (
                              <Bell className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Hidden Courts */}
            {hiddenCourts.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Hidden Courts ({hiddenCourts.length})</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {hiddenCourts.map((court) => {
                    const pref = prefs.get(court.id);
                    const hiddenUntil = pref?.hidden_until;
                    const isIndefinite = hiddenUntil && new Date(hiddenUntil).getFullYear() > 2100;

                    return (
                      <div
                        key={court.id}
                        className="flex items-center justify-between p-4 border rounded-lg bg-muted/50"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-muted-foreground">{court.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {court.city}, {court.state}
                          </p>
                          {hiddenUntil && (
                            <Badge variant="secondary" className="mt-1">
                              {isIndefinite
                                ? "Hidden indefinitely"
                                : `Hidden until ${formatDateEST(new Date(hiddenUntil), "MMM d, yyyy")}`}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnhide(court.id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          Unhide
                        </Button>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
