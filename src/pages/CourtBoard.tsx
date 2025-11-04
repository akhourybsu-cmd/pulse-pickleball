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
import { CourtFeed } from "@/components/court/feed/CourtFeed";
import { useToast } from "@/hooks/use-toast";
import { MapPin, MessageSquare, Activity, LogOut, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-new.png";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo.png";
import { UpcomingEvents } from "@/components/citi-events/UpcomingEvents";

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
  const [isAdmin, setIsAdmin] = useState(false);

  const PICKLEBALL_CITI_ID = "836003fb-fbd7-429c-8973-67ac6766a511";

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
    
    // Check if user is a Pickleball Citi admin
    if (user && courtId === PICKLEBALL_CITI_ID) {
      const { data: courtData } = await supabase
        .from("courts")
        .select("citi_admins")
        .eq("id", PICKLEBALL_CITI_ID)
        .single();
      
      if (courtData?.citi_admins?.includes(user.id)) {
        setIsAdmin(true);
      }
    }
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
          <Link to={currentUserId ? "/dashboard" : "/"}>
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            {currentUserId ? (
              <>
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
              </>
            ) : (
              <>
                <ThemeToggle />
                <Button 
                  onClick={() => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`)}
                  className="gap-2"
                  style={{
                    backgroundColor: '#B9E43B',
                    color: '#0E4C58',
                  }}
                >
                  Join Pulse
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Pulse Header - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 md:mb-12"
        style={{
          background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)',
          borderBottom: '1px solid rgba(169, 220, 61, 0.15)',
        }}
      >
        <div className="container mx-auto px-4 py-6 md:py-8">
          {courtId === PICKLEBALL_CITI_ID ? (
            <div className="flex items-center justify-between gap-3 md:gap-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex-1 flex items-center justify-center"
              >
                <img 
                  src={pickleballCitiLogo} 
                  alt="Pickleball Citi" 
                  className="h-24 md:h-32 lg:h-40 w-auto object-contain"
                  style={{
                    filter: 'drop-shadow(0px 4px 12px rgba(14, 76, 88, 0.2))'
                  }}
                />
              </motion.div>
              {currentUserId && (
                <div className="flex-shrink-0">
                  <CourtCheckIn courtId={court.id} userId={currentUserId} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 md:gap-6">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex-shrink-0"
              >
                <MapPin 
                  className="w-8 h-8 md:w-12 md:h-12"
                  style={{ 
                    color: '#A9DC3D',
                    filter: 'drop-shadow(0px 2px 4px rgba(169, 220, 61, 0.3))'
                  }} 
                />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 relative inline-block pb-2 break-words"
                  style={{
                    color: '#0E4C58',
                    letterSpacing: '0.02em',
                    textShadow: '0px 1px 2px rgba(14, 76, 88, 0.1)',
                    borderLeft: '3px solid #A9DC3D',
                    paddingLeft: '12px',
                  }}
                >
                  {court.name}
                  <motion.span
                    className="absolute bottom-0 left-3 h-0.5 bg-gradient-to-r from-[#A9DC3D] to-transparent"
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 0.8, delay: 0.5 }}
                    style={{ display: 'block' }}
                  />
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-sm md:text-lg leading-relaxed break-words"
                  style={{ color: '#0E4C58', opacity: 0.8 }}
                >
                  {court.city}, {court.state}
                  {court.location && ` • ${court.location}`}
                </motion.p>
              </div>
              {currentUserId && (
                <div className="flex-shrink-0">
                  <CourtCheckIn courtId={court.id} userId={currentUserId} />
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {courtId === PICKLEBALL_CITI_ID && (
          <UpcomingEvents courtId={courtId} isAdmin={isAdmin} currentUserId={currentUserId} />
        )}

        {!currentUserId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden rounded-lg p-8 md:p-12 text-center"
            style={{
              background: 'linear-gradient(135deg, #0E4C58 0%, #1a6b7a 100%)',
              boxShadow: '0 10px 40px rgba(14, 76, 88, 0.2)',
            }}
          >
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#B9E43B] rounded-full blur-3xl" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#A9DC3D] rounded-full blur-3xl" />
            </div>
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#B9E43B' }}>
                Join the Pickleball Citi Community
              </h2>
              <p className="text-lg md:text-xl mb-6 text-white/90 max-w-2xl mx-auto">
                Connect with fellow players, join exciting events, and stay updated on everything happening at Pickleball Citi. Create your free PULSE profile today!
              </p>
              <Button
                onClick={() => navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`)}
                size="lg"
                className="text-lg px-8 py-6"
                style={{
                  backgroundColor: '#B9E43B',
                  color: '#0E4C58',
                }}
              >
                Create Free Account
              </Button>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col gap-3 sm:gap-4">
          {channelId && (
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <CourtPresence courtId={court.id} channelId={channelId} />
              </CardContent>
            </Card>
          )}
        </div>

        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="feed" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Court Feed</span>
              <span className="sm:hidden">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Insights</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <CourtFeed courtId={court.id} currentUserId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-3 sm:space-y-4">
            <CourtAnalytics courtId={court.id} />
            <CourtHeatmap courtId={court.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
