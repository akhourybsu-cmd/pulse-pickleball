import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CourtHeatmap } from "@/components/court/CourtHeatmap";
import { CourtAnalytics } from "@/components/court/CourtAnalytics";
import { CourtMatchAnalytics } from "@/components/court/CourtMatchAnalytics";
import { CourtMatchTrends } from "@/components/court/CourtMatchTrends";
import { CourtTopPlayers } from "@/components/court/CourtTopPlayers";
import { MatchTypeBreakdown } from "@/components/court/MatchTypeBreakdown";
import { CourtCheckIn } from "@/components/court/CourtCheckIn";
import { CommunityHub } from "@/components/court/feed/CommunityHub";
import { useToast } from "@/hooks/use-toast";
import { MapPin, MessageSquare, Activity, LogOut, User as UserIcon, ExternalLink, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import logo from "@/assets/pulse-logo-new.png";
import pickleballCitiLogo from "@/assets/pickleball-citi-logo.png";
import { JoinableCalendarEvents } from "@/components/citi-events/JoinableCalendarEvents";
import { JoinableRoundRobinEvents } from "@/components/round-robin/JoinableRoundRobinEvents";
import VenueInfoCard from "@/components/VenueInfoCard";

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const PICKLEBALL_CITI_ID = "836003fb-fbd7-429c-8973-67ac6766a511";
  const TILDA_STONE_ID = "2bf21943-2efc-43fe-bab4-9bb7693d4674";
  const NORTH_ATTLEBORO_YMCA_ID = "51e71be8-2212-4d46-9f83-d7f2d2af3120";

  useEffect(() => {
    checkUser();
    if (courtId) {
      fetchCourt();
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

  const isTildaStone = courtId === TILDA_STONE_ID;
  const isNorthAttleboro = courtId === NORTH_ATTLEBORO_YMCA_ID;

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
      navigate("/player/dashboard");
    } else {
      setCourt(data);
    }
    setLoading(false);
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

      {/* Space Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 md:mb-12"
        style={{
          background: 'linear-gradient(180deg, #e9f8dc 0%, #ffffff 100%)',
          borderBottom: '1px solid rgba(169, 220, 61, 0.2)',
        }}
      >
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="flex items-start gap-3 md:gap-6 flex-wrap md:flex-nowrap">
            {courtId === PICKLEBALL_CITI_ID ? (
              <>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="flex items-center gap-6 flex-1"
                >
                  <img 
                    src={pickleballCitiLogo} 
                    alt="Pickleball Citi" 
                    className="h-40 md:h-52 lg:h-56 w-auto"
                    style={{ 
                      filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.1))'
                    }}
                  />
                  <div className="flex flex-col gap-1">
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.3 }}
                      className="text-xl md:text-2xl font-semibold"
                      style={{ color: '#0E4C58' }}
                    >
                      Cranston, RI
                    </motion.p>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 }}
                      className="text-sm md:text-base"
                      style={{ color: '#0E4C58', opacity: 0.7 }}
                    >
                      Powered by PULSE
                    </motion.p>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="w-full md:w-auto md:flex-shrink-0 flex flex-col items-end gap-2"
                >
                  <VenueInfoCard />
                  <div className="flex gap-2">
                    {currentUserId && (
                      <CourtCheckIn courtId={court.id} userId={currentUserId} />
                    )}
                    <Button
                      onClick={() => navigate('/reservations')}
                      size="sm"
                      className="gap-2 text-sm px-3 py-1.5 rounded-full"
                      style={{
                        backgroundColor: '#B9E43B',
                        color: '#0E4C58',
                      }}
                    >
                      <Calendar className="w-4 h-4" />
                      Court Reservations
                    </Button>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-2 text-sm px-3 py-1.5 rounded-full"
                    >
                      <a href="https://pickleballciti.com/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        Visit Official Website
                      </a>
                    </Button>
                  </div>
                </motion.div>
              </>
            ) : (
              <>
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
                    {isTildaStone ? "Attleboro, MA" : `${court.city}, ${court.state}`}
                    {!isTildaStone && !isNorthAttleboro && court.location && ` • ${court.location}`}
                  </motion.p>
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Pickleball Citi Mission Section */}
        {courtId === PICKLEBALL_CITI_ID && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative overflow-hidden rounded-xl shadow-sm p-6 md:p-8"
            style={{
              background: '#ffffff',
            }}
          >
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="text-3xl md:text-4xl font-semibold text-slate-800 text-center mb-8"
            >
              Join Pickleball Citi and Take Your Game to the Next Level
            </motion.h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="space-y-3 p-6 rounded-lg border-2 border-lime-200 bg-gradient-to-br from-lime-50 to-white"
              >
                <h3 className="text-xl font-semibold text-lime-700 mb-3">Our Mission</h3>
                <p className="text-slate-700 leading-7 text-sm">
                  At Pickleball Citi, our mission is to grow the game of pickleball for all ages, skill levels, and abilities by fostering an inclusive environment that promotes health, social connection, good sportsmanship, and fun.
                </p>
                <p className="text-slate-700 leading-7 text-sm">
                  We are committed to providing a welcoming atmosphere, supporting recreational enjoyment and competitive excellence through well-organized play, and engaging the community.
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="space-y-3 p-6 rounded-lg border-2 border-lime-200 bg-gradient-to-br from-lime-50 to-white"
              >
                <h3 className="text-xl font-semibold text-lime-700 mb-3">How We Support Players</h3>
                <p className="text-slate-700 leading-7 text-sm mb-3">
                  We are dedicated to helping athletes of all levels reach their full potential. Our comprehensive approach includes:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 text-sm">
                  <li>Personalized training programs</li>
                  <li>Expert coaches with proven track records</li>
                  <li>Recreational and competitive excellence</li>
                  <li>Welcoming atmosphere for all levels</li>
                  <li>Resources to achieve your goals</li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.8 }}
                className="space-y-3 p-6 rounded-lg border-2 border-lime-200 bg-gradient-to-br from-lime-50 to-white"
              >
                <h3 className="text-xl font-semibold text-lime-700 mb-3">Start Playing with Us</h3>
                <p className="text-slate-700 leading-7 text-sm font-medium">
                  Whether you're a beginner looking to learn the fundamentals or an experienced player looking to fine-tune your technique, join us today and take the first step towards becoming a better athlete!
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {courtId === PICKLEBALL_CITI_ID && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.0 }}
            className="flex justify-center py-8"
          >
            <Button
              onClick={() => navigate('/pickleball-citi-memberships')}
              size="lg"
              className="gap-4 px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all"
              style={{
                backgroundColor: '#B9E43B',
                color: '#0E4C58',
              }}
            >
              <img 
                src={pickleballCitiLogo} 
                alt="Pickleball Citi" 
                className="h-12 w-auto"
              />
              <span className="font-semibold">View Membership Options</span>
            </Button>
          </motion.div>
        )}
        
        {/* Upcoming Events - Pinned Section */}
        {courtId === PICKLEBALL_CITI_ID && (
          <div style={{ borderTop: '1px solid rgba(14, 76, 88, 0.15)', paddingTop: '1.5rem' }}>
            <JoinableCalendarEvents courtId={courtId} />
          </div>
        )}

        {courtId === PICKLEBALL_CITI_ID && (
          <div style={{ borderTop: '1px solid rgba(14, 76, 88, 0.15)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
            <JoinableRoundRobinEvents courtLocation={court.location || court.name} userId={currentUserId} />
          </div>
        )}

        {(courtId === NORTH_ATTLEBORO_YMCA_ID || (courtId !== PICKLEBALL_CITI_ID && court)) && (
          <div style={{ borderTop: '1px solid rgba(14, 76, 88, 0.15)', paddingTop: '1.5rem' }}>
            <JoinableRoundRobinEvents courtLocation={court.location || court.name} userId={currentUserId} />
          </div>
        )}

        {/* Join Pulse CTA for non-logged-in users */}
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
                {courtId === PICKLEBALL_CITI_ID 
                  ? "Join the Pickleball Citi Community"
                  : `Want to Join ${court.name} Events?`
                }
              </h2>
              <p className="text-lg md:text-xl mb-6 text-white/90 max-w-2xl mx-auto">
                {courtId === PICKLEBALL_CITI_ID
                  ? "Connect with fellow players, join exciting events, and stay updated on everything happening at Pickleball Citi. Create your free PULSE profile today!"
                  : "Connect with fellow players, join exciting events, and access the court feed. Create your free PULSE profile today!"
                }
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
                Join Pulse Today
              </Button>
            </div>
          </motion.div>
        )}

        {/* Community Hub & Stats Tabs */}
        <Tabs defaultValue="community" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="community" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <MessageSquare className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Community Hub</span>
              <span className="sm:hidden">Community</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1 flex-col py-2 px-2 text-xs sm:flex-row sm:gap-2 sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Insights</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="community">
            <Card>
              <CardContent className="pt-4 sm:pt-6">
                <CommunityHub courtId={court.id} currentUserId={currentUserId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-3 sm:space-y-4">
            <CourtAnalytics courtId={court.id} />
            <CourtMatchAnalytics courtId={court.id} />
            <CourtMatchTrends courtId={court.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <CourtTopPlayers courtId={court.id} />
              <MatchTypeBreakdown courtId={court.id} />
            </div>
            <CourtHeatmap courtId={court.id} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}