import { useEffect, useState, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, RefreshCw, HelpCircle, MessageSquare, Trash2, Award, UserCog, User as UserIcon, Settings, Share2, CalendarDays, Activity, Zap } from "lucide-react";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo-new.png";
import { CourtStats } from "@/components/CourtStats";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import { SmartMatch } from "@/components/court/SmartMatch";
import { LFGNotifications } from "@/components/court/LFGNotifications";
import { MFAPrompt } from "@/components/auth/MFAPrompt";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationDrawer, Notification } from "@/components/NotificationDrawer";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  current_rating: number;
  week_start_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
  total_points_for: number;
  total_points_against: number;
  avg_opponent_rating: number;
}


const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [hasNewParticipants, setHasNewParticipants] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Notification state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const unreadCount = notifications.filter(n => n.unread).length;

  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Check for existing session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.log("No valid session, redirecting to auth");
          navigate("/auth");
          return;
        }

        const user = session.user;
        setUser(user);

        // Fetch all data in parallel for faster loading
        const [profileResult, roleResult, postsResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
          supabase.from("court_posts").select(`
            id,
            viewed_participants_count,
            court_post_participants(count)
          `).eq("user_id", user.id).eq("status", "open")
        ]);

        if (profileResult.error) {
          console.error("Profile fetch error:", profileResult.error);
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data);
        setIsAdmin(!!roleResult.data);

        // Check for new participants
        if (postsResult.data) {
          const hasNew = postsResult.data.some((post: any) => {
            const currentCount = post.court_post_participants[0]?.count || 0;
            const viewedCount = post.viewed_participants_count || 0;
            return currentCount > viewedCount;
          });
          setHasNewParticipants(hasNew);
        }

        setLoading(false);
      } catch (error) {
        console.error("Dashboard load error:", error);
        toast.error("Failed to load dashboard");
        navigate("/auth");
      }
    };

    fetchUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === "SIGNED_OUT") {
          navigate("/auth");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Profile updates will be fetched after match recording or refresh

  // Participant check already handled in initial load

  const handleRefreshStats = async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      // Recalculate all ratings using cumulative model
      const { error: recomputeError } = await supabase.rpc('recalculate_all_ratings');

      if (recomputeError) {
        console.error('Recomputation error:', recomputeError);
        toast.error("Failed to recalculate ratings");
        return;
      }

      // Fetch the updated profile
      const { data: profileData, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        toast.error("Failed to refresh stats");
        return;
      }

      setProfile(profileData);
      toast.success("Ratings recalculated successfully");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh stats");
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearHistory = async () => {
    if (!user?.id) return;
    
    const confirmed = window.confirm(
      "⚠️ WARNING: This will permanently delete ALL matches, approvals, and reset ALL player stats to 3.00.\n\n" +
      "This action CANNOT be undone and is intended for beta testing only.\n\n" +
      "Are you absolutely sure you want to continue?"
    );

    if (!confirmed) return;
    
    setClearing(true);
    try {
      const { error } = await supabase.rpc('clear_all_match_history_authenticated');

      if (error) {
        console.error('Clear history error:', error);
        toast.error("Failed to clear match history");
        return;
      }

      // Fetch the updated profile
      const { data: profileData, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (fetchError) {
        toast.error("Failed to refresh profile");
        return;
      }

      setProfile(profileData);
      toast.success("Match history cleared successfully");
    } catch (error) {
      console.error('Clear error:', error);
      toast.error("Failed to clear match history");
    } finally {
      setClearing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleClearOne = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSelectNotification = (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      // Mark as read
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, unread: false } : n)
      );
      // Close drawer
      setIsDrawerOpen(false);
      // Navigate to the link
      navigate(notification.link);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pulse Pickleball',
      text: 'Join me on Pulse - Track your pickleball journey and compete with friends!',
      url: 'https://pulsepb.com'
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Thanks for spreading the word!");
      } else {
        await navigator.clipboard.writeText('https://pulsepb.com');
        toast.success("Share link copied to clipboard!");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error sharing:', error);
        toast.error("Could not share. Please try again.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const winRate = profile && profile.total_matches > 0
    ? ((profile.wins / profile.total_matches) * 100).toFixed(1)
    : "0.0";

  const totalPointDifferential = (profile?.total_points_for || 0) - (profile?.total_points_against || 0);
  const pointDifferentialPerGame = profile && profile.total_matches > 0
    ? (totalPointDifferential / profile.total_matches).toFixed(1)
    : "0.0";
  
  const weeklyChange = profile 
    ? profile.current_rating - profile.week_start_rating 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <OnboardingTutorial 
          userId={user.id} 
          onComplete={() => console.log('Tutorial completed')}
        />
      )}
      
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity logo-pulse" />
          </Link>
          <div className="flex items-center gap-3">
            <UnverifiedMatchesIndicator />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/profile/${user?.id}`)} 
              className="rounded-full"
              data-tour="view-profile"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">View Profile</span>
            </Button>
            <ThemeToggle />
            <NotificationBell 
              unreadCount={unreadCount}
              onOpen={() => setIsDrawerOpen(true)}
            />
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
        className="mb-2 md:mb-3"
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
              <Zap 
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
                className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 relative inline-block pb-2"
                style={{
                  color: '#0E4C58',
                  letterSpacing: '0.02em',
                  textShadow: '0px 1px 2px rgba(14, 76, 88, 0.1)',
                  borderLeft: '3px solid #A9DC3D',
                  paddingLeft: '12px',
                }}
              >
                Welcome back, {profile?.display_name || profile?.full_name}!
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
                className="text-sm md:text-lg leading-relaxed"
                style={{ color: '#0E4C58', opacity: 0.8 }}
              >
                Track your pickleball journey, analyze your performance, and compete with your community
              </motion.p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-3 md:py-4 md:py-6">
        {/* MFA Prompt */}
        <div className="mb-6">
          <MFAPrompt />
        </div>

        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              
              <div className="space-y-3 w-full md:w-auto">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/match/new")}
                  className="shadow-[var(--shadow-glow)] w-full md:w-auto md:text-lg md:py-6 pulse-glow button-ripple"
                  data-tour="record-match"
                >
                  <Plus className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                  Record New Match
                </Button>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => navigate("/court/connector")}
                    className="relative flex flex-col items-start py-3 h-auto md:text-lg md:py-6 [&:hover_span.text-muted-foreground]:text-black"
                    data-tour="court-connector"
                  >
                    <div className="flex items-center w-full">
                      <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm md:text-base">Court Connector</span>
                      {hasNewParticipants && (
                        <span className="absolute top-2 right-2 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs md:text-sm text-muted-foreground mt-1">Find a group near you</span>
                  </Button>

                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/match/history")}
                    className="flex flex-col items-start py-3 h-auto md:text-lg md:py-6 [&:hover_span.text-muted-foreground]:text-black"
                    data-tour="match-history"
                  >
                    <div className="flex items-center w-full">
                      <Calendar className="w-5 h-5 md:w-6 md:h-6 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm md:text-base">Match History</span>
                    </div>
                    <span className="text-xs md:text-sm text-muted-foreground mt-1">View your matches</span>
                  </Button>

                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/events/my-calendar-registrations")}
                    className="flex flex-col items-start py-3 h-auto md:text-lg md:py-6 [&:hover_span.text-muted-foreground]:text-black col-span-2 md:col-span-1"
                  >
                    <div className="flex items-center w-full">
                      <CalendarDays className="w-5 h-5 md:w-6 md:h-6 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm md:text-base">My Registered Events</span>
                    </div>
                    <span className="text-xs md:text-sm text-muted-foreground mt-1">View upcoming reservations</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="border-2 border-primary pulse-score-focal" data-tour="pulse-score">
            <CardHeader className="pb-3 md:pb-4">
              <CardDescription className="md:text-base">Live Pulse Score</CardDescription>
              <CardTitle className="flex items-center gap-3">
                <motion.span 
                  className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary pulse-score-number opacity-0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
                >
                  {profile?.current_rating?.toFixed(2) || "3.00"}
                </motion.span>
                <motion.svg 
                  className="ecg-pulse flex-shrink-0 opacity-0" 
                  width="60" 
                  height="20" 
                  viewBox="0 0 80 24"
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: 1.55 }}
                >
                  <path 
                    d="M0 12 L20 12 L25 4 L30 20 L35 12 L80 12" 
                    stroke="rgb(163, 230, 53)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    pathLength="100"
                  />
                </motion.svg>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm md:text-base">
                <span className="text-muted-foreground">Weekly snapshot (Mon): </span>
                <span className="font-semibold">
                  {profile?.week_start_rating?.toFixed(2) || '3.00'}
                </span>
                <span className={`ml-2 font-semibold ${weeklyChange > 0 ? 'text-green-500' : weeklyChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  ({weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)})
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="text-xs md:text-sm">Record</CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {profile?.wins}W - {profile?.losses}L
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                {profile?.total_matches} {profile?.total_matches === 1 ? 'match' : 'matches'} played
              </CardContent>
            </Card>

            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="flex items-center gap-2 text-xs md:text-sm">
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  Win Rate
                </CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">{winRate}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="flex items-center gap-2 text-xs md:text-sm">
                  <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                  Point Diff / Game
                </CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {parseFloat(pointDifferentialPerGame) > 0 ? "+" : ""}{pointDifferentialPerGame}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                For: {profile?.total_points_for || 0} • Against: {profile?.total_points_against || 0}
              </CardContent>
            </Card>

            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="text-xs md:text-sm">Avg. Opponent Rating</CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {profile?.avg_opponent_rating?.toFixed(2) || "N/A"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                Strength of schedule
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-8 space-y-6" data-tour="court-stats">
          <SmartMatch userId={user?.id || null} />
          <LFGNotifications />
          {user && <CourtStats userId={user.id} />}
        </div>

        <div className="space-y-4 md:space-y-6">
          {/* First row - Round Robin centered */}
          <div className="flex justify-center">
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/round-robin")}
              className="h-auto py-4 md:text-lg md:py-6 w-full md:w-auto"
            >
              <Trophy className="w-5 h-5 md:w-6 md:h-6 mr-2" />
              Organize a Round Robin Event
            </Button>
          </div>

          {/* Second row - Edit Profile and Help & FAQ */}
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <Button
              size="lg" 
              variant="outline"
              onClick={() => navigate("/profile/edit")}
              className="md:text-lg md:py-6"
            >
              <UserCog className="w-5 h-5 md:w-6 md:h-6 mr-2" />
              Edit Profile
            </Button>

            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/faq")}
              className="md:text-lg md:py-6"
            >
              <HelpCircle className="w-5 h-5 md:w-6 md:h-6 mr-2" />
              Help & FAQ
            </Button>
          </div>

          {/* Admin buttons if admin */}
          {isAdmin && (
            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/session/queue")}
                className="md:text-lg md:py-6"
              >
                Session Queue (Admin)
              </Button>
              
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/events")}
                data-tour="events"
                className="md:text-lg md:py-6"
              >
                <CalendarDays className="w-5 h-5 md:w-6 md:h-6 mr-2" />
                Events
              </Button>
            </div>
          )}
        </div>

        {/* Share Button */}
        <div className="flex justify-center mt-8">
          <Button 
            onClick={handleShare}
            variant="default"
            size="lg"
            className="gap-2 w-full md:w-auto shadow-[var(--shadow-glow)]"
          >
            <Share2 className="h-5 w-5" />
            Invite Friends to Pulse
          </Button>
        </div>

        {/* Admin Controls */}
        {isAdmin && (
          <div className="flex flex-col gap-3 mt-8">
            <Button 
              variant="default" 
              size="lg"
              onClick={() => navigate("/admin")}
              className="w-full md:w-auto"
            >
              <Settings className="w-4 h-4 mr-2" />
              Admin Dashboard
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshStats}
              disabled={refreshing || clearing}
              className="w-full md:w-auto"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Recalculate Ratings
            </Button>
          </div>
        )}
      </div>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        notifications={notifications}
        onClose={() => setIsDrawerOpen(false)}
        onClearAll={handleClearAll}
        onClearOne={handleClearOne}
        onSelectNotification={handleSelectNotification}
      />

      {/* Special button for alexanderskhoury@gmail.com */}
      {user?.email === "alexanderskhoury@gmail.com" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            size="lg"
            onClick={() => navigate("/tournaments")}
            className="shadow-lg"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Browse Tournaments
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Dashboard;
