import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useToast } from "@/hooks/use-toast";
import { Users, EyeOff, Eye, MapPin, Plus, Trash2, LogOut, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-new.png";
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

    // Fetch LFG counts for all courts
    const { data: lfgData } = await supabase
      .from("lfg_posts")
      .select("court_id")
      .eq("status", "open");

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
        };
      }) || [];

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

      {/* Hero Section with Gradient Background */}
      <div className="bg-gradient-to-br from-background via-muted/10 to-background py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">Court Connector</h1>
              <p className="text-muted-foreground md:text-lg">Select a court to view games and connect with players</p>
            </div>
            <div className="flex gap-2">
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
        </div>
      </div>

      {/* Courts Grid Section */}
      <div className="bg-gradient-to-br from-background via-muted/10 to-background py-8">
        <div className="container mx-auto px-4">
          {loading ? (
            <div className="text-center py-12">Loading courts...</div>
          ) : visibleCourts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleCourts.map((court, index) => (
                <motion.div
                  key={court.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={court.isHidden ? 'opacity-60' : ''}
                >
                  <Card 
                    className="cursor-pointer rounded-2xl border-2 border-border shadow-lg hover:shadow-[0_2px_6px_rgba(0,0,0,0.05),0_4px_12px_rgba(169,220,61,0.15)] transition-all duration-300 h-full bg-card"
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
                </motion.div>
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
      </div>
    </div>
  );
}
