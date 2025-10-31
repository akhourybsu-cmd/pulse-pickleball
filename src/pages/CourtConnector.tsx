import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Users, EyeOff, Eye, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CourtPref {
  hidden_until: string | null;
}

interface CourtWithLFGCount extends Court {
  lfgCount: number;
  isHidden: boolean;
}

export default function CourtConnector() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<CourtWithLFGCount[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchCourtsWithLFGCount();
    }
  }, [currentUserId, showHidden]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchCourtsWithLFGCount = async () => {
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
    prefsData?.forEach((pref: any) => {
      prefsMap.set(pref.court_id, {
        hidden_until: pref.hidden_until,
      });
    });

    // Fetch LFG counts for all courts
    const { data: lfgData } = await supabase
      .from("lfg_posts")
      .select("court_id")
      .eq("status", "open");

    const lfgCountMap = new Map<string, number>();
    lfgData?.forEach((lfg: any) => {
      lfgCountMap.set(lfg.court_id, (lfgCountMap.get(lfg.court_id) || 0) + 1);
    });

    // Build courts with LFG count and hidden status
    const courtsWithData: CourtWithLFGCount[] = courtsData?.map((court) => {
      const pref = prefsMap.get(court.id);
      const isHidden = pref?.hidden_until ? new Date(pref.hidden_until) > new Date() : false;
      
      return {
        ...court,
        lfgCount: lfgCountMap.get(court.id) || 0,
        isHidden,
      };
    }) || [];

    setCourts(courtsWithData);
    setLoading(false);
  };

  const handleHideCourt = async (courtId: string, duration: '7' | '30' | '90') => {
    if (!currentUserId) return;

    const days = parseInt(duration);
    const date = new Date();
    date.setDate(date.getDate() + days);
    const hiddenUntil = date.toISOString();

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert(
        {
          user_id: currentUserId,
          court_id: courtId,
          hidden_until: hiddenUntil,
        },
        {
          onConflict: 'user_id,court_id'
        }
      );

    if (error) {
      console.error('Hide error:', error);
      toast({
        title: "Error",
        description: "Failed to hide court",
        variant: "destructive",
      });
    } else {
      const courtName = courts.find(c => c.id === courtId)?.name;
      toast({
        title: "Court Hidden",
        description: `${courtName} will be hidden for ${duration} days`,
      });
      fetchCourtsWithLFGCount();
    }
  };

  const handleUnhideCourt = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await (supabase as any)
      .from("user_court_prefs")
      .upsert(
        {
          user_id: currentUserId,
          court_id: courtId,
          hidden_until: null,
        },
        {
          onConflict: 'user_id,court_id'
        }
      );

    if (error) {
      console.error('Unhide error:', error);
      toast({
        title: "Error",
        description: "Failed to unhide court",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Court Unhidden",
        description: "Court is now visible",
      });
      fetchCourtsWithLFGCount();
    }
  };

  const visibleCourts = showHidden ? courts : courts.filter(c => !c.isHidden);
  const hiddenCount = courts.filter(c => c.isHidden).length;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
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
            <p className="text-muted-foreground">Select a court to view games and connect with players</p>
          </div>
          <div className="flex gap-2">
            {hiddenCount > 0 && (
              <Button 
                onClick={() => setShowHidden(!showHidden)} 
                variant="outline" 
                size="sm"
                className="gap-2"
              >
                {showHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showHidden ? 'Hide' : 'Show'} Hidden ({hiddenCount})
              </Button>
            )}
            <Button onClick={() => navigate("/court/history")} variant="outline" size="sm">
              Court Activity
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading courts...</div>
        ) : visibleCourts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleCourts.map((court) => (
              <Card 
                key={court.id} 
                className={`cursor-pointer hover:shadow-lg transition-all ${court.isHidden ? 'opacity-60' : ''}`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1" onClick={() => navigate(`/court/board/${court.id}`)}>
                      <CardTitle className="text-2xl">{court.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-2">
                        <MapPin className="w-3 h-3" />
                        {court.city}, {court.state}
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <EyeOff className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {court.isHidden ? (
                          <DropdownMenuItem onClick={() => handleUnhideCourt(court.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Unhide Court
                          </DropdownMenuItem>
                        ) : (
                          <>
                            <DropdownMenuItem onClick={() => handleHideCourt(court.id, '7')}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide for 7 days
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleHideCourt(court.id, '30')}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide for 30 days
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleHideCourt(court.id, '90')}>
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide for 90 days
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent onClick={() => navigate(`/court/board/${court.id}`)}>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Active LFG Posts:</span>
                    <Badge variant={court.lfgCount > 0 ? "default" : "secondary"} className="ml-auto">
                      {court.lfgCount}
                    </Badge>
                  </div>
                  {court.isHidden && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      This court is hidden
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                {showHidden ? 'All courts are hidden' : 'No courts available'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
