import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Users, EyeOff, Eye, MapPin, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface CourtPref {
  id: string;
  court_id: string;
  hidden: boolean;
}

interface CourtWithLFGCount extends Court {
  lfgCount: number;
  isHidden: boolean;
  isAdded: boolean;
  isHomeCourt?: boolean;
}

export default function CourtConnector() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [courts, setCourts] = useState<CourtWithLFGCount[]>([]);
  const [allCourts, setAllCourts] = useState<Court[]>([]);
  const [showHidden, setShowHidden] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addCourtDialogOpen, setAddCourtDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [homeCourtId, setHomeCourtId] = useState<string | null>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchCourtsWithLFGCount();
    }
  }, [currentUserId, showHidden]);

  const checkUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      toast({
        title: "Session Expired",
        description: "Please sign in again to continue",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }
    
    setCurrentUserId(user.id);
  };

  const fetchCourtsWithLFGCount = async () => {
    if (!currentUserId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);

    // Fetch user's home court
    const { data: profileData } = await supabase
      .from("profiles_public")
      .select("home_court_id")
      .eq("id", currentUserId)
      .single();

    setHomeCourtId(profileData?.home_court_id || null);

    // Fetch all courts
    const { data: courtsData, error: courtsError } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (courtsError) {
      console.error("Courts fetch error:", courtsError);
      toast({
        title: "Error",
        description: "Failed to load courts. Please try refreshing the page.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    setAllCourts(courtsData || []);

    // Fetch user preferences
    const { data: prefsData } = await supabase
      .from("user_court_prefs")
      .select("*")
      .eq("user_id", currentUserId!);

    const prefsMap = new Map<string, CourtPref>();
    prefsData?.forEach((pref: any) => {
      prefsMap.set(pref.court_id, {
        id: pref.id,
        court_id: pref.court_id,
        hidden: pref.hidden_until !== null,
      });
    });

    // Fetch LFG counts for all courts (only upcoming/active posts)
    const now = new Date().toISOString();
    const { data: lfgData } = await supabase
      .from("lfg_posts")
      .select("court_id")
      .eq("status", "open")
      .gte("starts_at", now);

    const lfgCountMap = new Map<string, number>();
    lfgData?.forEach((lfg: any) => {
      lfgCountMap.set(lfg.court_id, (lfgCountMap.get(lfg.court_id) || 0) + 1);
    });

    // Build courts with LFG count and status - only show courts that user has added
    const courtsWithData: CourtWithLFGCount[] = courtsData
      ?.filter((court) => prefsMap.has(court.id))
      .map((court) => {
        const pref = prefsMap.get(court.id)!;
        
        return {
          ...court,
          lfgCount: lfgCountMap.get(court.id) || 0,
          isHidden: pref.hidden,
          isAdded: true,
          isHomeCourt: court.id === profileData?.home_court_id,
        };
      }) || [];

    // Sort courts: home court first, then by name
    courtsWithData.sort((a, b) => {
      if (a.isHomeCourt && !b.isHomeCourt) return -1;
      if (!a.isHomeCourt && b.isHomeCourt) return 1;
      return a.name.localeCompare(b.name);
    });

    setCourts(courtsWithData);
    setLoading(false);
  };

  const handleAddCourt = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("user_court_prefs")
      .insert({
        user_id: currentUserId,
        court_id: courtId,
        hidden_until: null,
      });

    if (error) {
      console.error('Add court error:', error);
      toast({
        title: "Error",
        description: "Failed to add court",
        variant: "destructive",
      });
    } else {
      const courtName = allCourts.find(c => c.id === courtId)?.name;
      toast({
        title: "Court Added",
        description: `${courtName} has been added to your courts`,
      });
      setAddCourtDialogOpen(false);
      setSearchQuery("");
      fetchCourtsWithLFGCount();
    }
  };

  const handleHideCourt = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("user_court_prefs")
      .update({ hidden_until: new Date().toISOString() })
      .eq("user_id", currentUserId)
      .eq("court_id", courtId);

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
        description: `${courtName} has been hidden`,
      });
      fetchCourtsWithLFGCount();
    }
  };

  const handleUnhideCourt = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("user_court_prefs")
      .update({ hidden_until: null })
      .eq("user_id", currentUserId)
      .eq("court_id", courtId);

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

  const handleRemoveCourt = async (courtId: string) => {
    if (!currentUserId) return;

    const { error } = await supabase
      .from("user_court_prefs")
      .delete()
      .eq("user_id", currentUserId)
      .eq("court_id", courtId);

    if (error) {
      console.error('Remove court error:', error);
      toast({
        title: "Error",
        description: "Failed to remove court",
        variant: "destructive",
      });
    } else {
      const courtName = courts.find(c => c.id === courtId)?.name;
      toast({
        title: "Court Removed",
        description: `${courtName} has been removed from your courts`,
      });
      fetchCourtsWithLFGCount();
    }
  };

  const visibleCourts = showHidden ? courts : courts.filter(c => !c.isHidden);
  const hiddenCount = courts.filter(c => c.isHidden).length;

  // Filter available courts (not yet added)
  const addedCourtIds = new Set(courts.map(c => c.id));
  const availableCourts = allCourts.filter(court => 
    !addedCourtIds.has(court.id) &&
    (searchQuery === "" || 
     court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
     court.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
     court.state.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Court Connector</h1>
          <p className="text-sm text-muted-foreground font-normal">Find local courts, connect with players, and rally your next match</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={addCourtDialogOpen} onOpenChange={setAddCourtDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Court
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-background z-50">
              <DialogHeader>
                <DialogTitle>Add a Court</DialogTitle>
                <DialogDescription>
                  Search and add courts to your list
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Search courts by name, city, or state..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {availableCourts.length > 0 ? (
                    availableCourts.map((court) => (
                      <Card key={court.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                        <CardHeader className="p-4" onClick={() => handleAddCourt(court.id)}>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{court.name}</CardTitle>
                              <CardDescription className="flex items-center gap-1 mt-1">
                                <MapPin className="w-3 h-3" />
                                {court.city}, {court.state}
                              </CardDescription>
                            </div>
                            <Button size="sm" variant="outline" className="gap-2">
                              <Plus className="w-4 h-4" />
                              Add
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      {searchQuery ? "No courts found matching your search" : "All courts have been added"}
                    </p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">Loading courts...</div>
      ) : visibleCourts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleCourts.map((court) => (
            <Card 
              key={court.id}
              className={`cursor-pointer rounded-2xl border-2 shadow-lg transition-all duration-300 h-full ${
                court.isHomeCourt 
                  ? 'border-primary shadow-primary/20 hover:shadow-primary/30 bg-gradient-to-br from-card to-primary/5' 
                  : 'border-border hover:shadow-md bg-card'
              } ${court.isHidden ? 'opacity-60' : ''}`}
              onClick={() => {
                if (court.id === '4a5d9fb8-981b-42f1-9504-595cb8f22fca') {
                  navigate('/masonfield');
                } else {
                  navigate(`/court/board/${court.id}`);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{court.name}</CardTitle>
                      {court.isHomeCourt && (
                        <Badge variant="default" className="text-xs">Home Court</Badge>
                      )}
                    </div>
                    <CardDescription className="flex items-center gap-1 mt-1.5">
                      <MapPin className="w-3 h-3" />
                      {court.city}, {court.state}
                    </CardDescription>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <EyeOff className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-background z-50">
                      <DialogHeader>
                        <DialogTitle>Court Actions</DialogTitle>
                        <DialogDescription>
                          Manage {court.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        {court.isHidden ? (
                          <Button 
                            onClick={() => handleUnhideCourt(court.id)} 
                            variant="outline" 
                            className="w-full justify-start gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            Unhide Court
                          </Button>
                        ) : (
                          <Button 
                            onClick={() => handleHideCourt(court.id)} 
                            variant="outline" 
                            className="w-full justify-start gap-2"
                          >
                            <EyeOff className="w-4 h-4" />
                            Hide Court
                          </Button>
                        )}
                        <Button 
                          onClick={() => handleRemoveCourt(court.id)} 
                          variant="destructive" 
                          className="w-full justify-start gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove Court
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>Active LFG Posts:</span>
                  </div>
                  <Badge className="bg-primary text-primary-foreground">
                    {court.lfgCount}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="rounded-2xl border-2 border-border shadow-lg">
          <CardContent className="text-center py-12 space-y-4">
            <p className="text-muted-foreground">
              {showHidden ? 'All courts are hidden' : 'No courts added yet'}
            </p>
            <Button onClick={() => setAddCourtDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Add Your First Court
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
