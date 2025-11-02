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
import { motion } from "framer-motion";
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
            <div className="flex-shrink-0">
              <CourtCheckIn courtId={court.id} userId={currentUserId} />
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 sm:gap-4">
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
