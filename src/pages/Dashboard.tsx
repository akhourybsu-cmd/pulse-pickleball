import { useEffect, useState, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, RefreshCw, HelpCircle, MessageSquare, Trash2, Award, UserCog, User as UserIcon, Settings, Share2, CalendarDays, Activity, Zap, Search, Download, Filter, Bell, Ticket, Users, ExternalLink, Link2, History, PlusCircle, LayoutGrid, BookOpen } from "lucide-react";
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
import { DashboardTile } from "@/components/dashboard/DashboardTile";

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
  const [homeCourtId, setHomeCourtId] = useState<string | null>(null);
  const [homeCourtName, setHomeCourtName] = useState<string>("");

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
        const [profileResult, roleResult, postsResult, publicProfileResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
          supabase.from("court_posts").select(`
            id,
            viewed_participants_count,
            court_post_participants(count)
          `).eq("user_id", user.id).eq("status", "open"),
          supabase.from("profiles_public").select("home_court_id").eq("id", user.id).single()
        ]);

        if (profileResult.error) {
          console.error("Profile fetch error:", profileResult.error);
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data);
        setIsAdmin(!!roleResult.data);

        // Fetch home court info if available
        if (publicProfileResult.data?.home_court_id) {
          setHomeCourtId(publicProfileResult.data.home_court_id);
          const { data: courtData } = await supabase
            .from("courts")
            .select("name")
            .eq("id", publicProfileResult.data.home_court_id)
            .single();
          if (courtData) {
            setHomeCourtName(courtData.name);
          }
        }

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
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
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

      {/* Zone 1: Hero Section + Primary Actions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
        style={{
          background: 'var(--hero-bg)',
          borderBottom: '1px solid var(--hero-border)',
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
                  color: '#A6DB5A',
                  filter: 'none'
                }} 
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-3 relative inline-block pb-2"
                style={{
                  color: 'var(--hero-heading)',
                  letterSpacing: '0.02em',
                  borderLeft: '3px solid #A6DB5A',
                  paddingLeft: '12px',
                }}
              >
                Welcome back, {profile?.display_name || profile?.full_name}!
                <motion.span
                  className="absolute bottom-0 left-3 h-0.5 bg-gradient-to-r from-[#A6DB5A] to-transparent"
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
                className="text-sm md:text-lg leading-relaxed mb-4"
                style={{ color: 'var(--hero-body)' }}
              >
                Track your pickleball journey, analyze your performance, and compete with your community
              </motion.p>
              
              {/* Primary Action Buttons */}
              <div className="flex flex-col sm:flex-row items-start gap-3 mt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/match/new")}
                  className="shadow-[var(--shadow-glow)] w-full sm:w-auto hover:scale-105 hover:shadow-xl transition-all"
                  data-tour="record-match"
                >
                  <Plus className="w-5 h-5 mr-2 flex-shrink-0" />
                  Record New Match
                </Button>

                {homeCourtId && (
                  <Button 
                    variant="secondary" 
                    size="lg" 
                    className="w-full sm:w-auto shadow-sm hover:shadow-lg hover:scale-105 transition-all"
                    onClick={() => navigate(`/court/board/${homeCourtId}`)}
                  >
                    <MapPin className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span className="truncate">
                      Go to {homeCourtName || 'Home Court'}
                    </span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 pb-6">
        {/* MFA Prompt */}
        <div className="mb-6">
          <MFAPrompt />
        </div>

        {/* Quick Action Toolbar */}
        <div className="mb-8">
          <Card className="border-t-2 border-t-primary shadow-sm">
            <CardContent className="p-0">
              <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0">
                <button
                  onClick={() => navigate("/court/connector")}
                  className="p-4 md:p-6 hover:bg-muted/50 hover:scale-[1.02] hover:shadow-md transition-all group text-left"
                  aria-label="Open Court Connector"
                  data-tour="court-connector"
                >
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2 w-full">
                      <Link2 className="w-5 h-5 md:w-6 md:h-6 text-primary flex-shrink-0" />
                      {hasNewParticipants && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors">Court Connector</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">Find a group</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/match/history")}
                  className="p-4 md:p-6 hover:bg-muted/50 hover:scale-[1.02] hover:shadow-md transition-all group text-left"
                  aria-label="Open Match History"
                  data-tour="match-history"
                >
                  <div className="flex flex-col items-start gap-2">
                    <History className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    <div>
                      <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors">Match History</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">View matches</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/events/my-calendar-registrations")}
                  className="p-4 md:p-6 hover:bg-muted/50 hover:scale-[1.02] hover:shadow-md transition-all group text-left"
                  aria-label="Open My Events"
                >
                  <div className="flex flex-col items-start gap-2">
                    <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    <div>
                      <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors">My Events</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">View registrations</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => navigate("/round-robin")}
                  className="p-4 md:p-6 hover:bg-muted/50 hover:scale-[1.02] hover:shadow-md transition-all group text-left"
                  aria-label="Open Round Robin Hub"
                >
                  <div className="flex flex-col items-start gap-2">
                    <Trophy className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                    <div>
                      <h3 className="font-bold text-sm md:text-base group-hover:text-primary transition-colors">Round Robin</h3>
                      <p className="text-xs md:text-sm text-muted-foreground">Create event</p>
                    </div>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zone 2: Player Scoreboard */}
        <div className="mb-8">
          <Card className="border-l-4 border-l-primary shadow-sm" data-tour="pulse-score">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6">
                {/* Left: Live Pulse Score */}
                <div className="flex-1 min-w-0">
                  <CardDescription className="text-sm md:text-base mb-2">Live Pulse Score</CardDescription>
                  <div className="flex items-center gap-3 mb-2">
                    <motion.span 
                      className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary pulse-score-number"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.8, delay: 0.75, ease: "easeOut" }}
                    >
                      {profile?.current_rating?.toFixed(2) || "3.00"}
                    </motion.span>
                    <motion.svg 
                      className="ecg-pulse flex-shrink-0" 
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
                  </div>
                </div>

                {/* Right: Stats Grid */}
                <div className="grid grid-cols-2 gap-4 lg:w-1/2">
                  <div className="space-y-1">
                    <CardDescription className="text-xs">Record</CardDescription>
                    <p className="text-2xl md:text-3xl font-bold">
                      {profile?.wins}W - {profile?.losses}L
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.total_matches} {profile?.total_matches === 1 ? 'match' : 'matches'} played
                    </p>
                  </div>

                  <div className="space-y-1">
                    <CardDescription className="text-xs flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Win Rate
                    </CardDescription>
                    <p className="text-2xl md:text-3xl font-bold">{winRate}%</p>
                  </div>

                  <div className="space-y-1">
                    <CardDescription className="text-xs flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      Point Diff / Game
                    </CardDescription>
                    <p className="text-2xl md:text-3xl font-bold">
                      {parseFloat(pointDifferentialPerGame) > 0 ? "+" : ""}{pointDifferentialPerGame}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      For: {profile?.total_points_for || 0} • Against: {profile?.total_points_against || 0}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <CardDescription className="text-xs">Avg. Opponent Rating</CardDescription>
                    <p className="text-2xl md:text-3xl font-bold">
                      {profile?.avg_opponent_rating?.toFixed(2) || "N/A"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Strength of schedule
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Zone 3: Secondary Tools - Smart Match, LFG, Stats by Court */}
        <div className="mb-8 space-y-6" data-tour="court-stats">
          <SmartMatch userId={user?.id || null} />
          <LFGNotifications />
          {user && <CourtStats userId={user.id} />}
        </div>

        {/* Account & Community Band */}
        <Card className="bg-gradient-to-br from-muted/30 to-background shadow-sm mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 items-stretch">
              {/* Left: Edit Profile and Help & FAQ */}
              <div className="flex-1 flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg" 
                  variant="subtle"
                  onClick={() => navigate("/profile/edit")}
                  className="flex-1 rounded-xl gap-1.5 h-12"
                >
                  <UserCog className="w-4 h-4 stroke-[2.5]" />
                  Edit Profile
                </Button>

                <Button 
                  size="lg" 
                  variant="subtle"
                  onClick={() => navigate("/faq")}
                  className="flex-1 rounded-xl gap-1.5 h-12"
                >
                  <HelpCircle className="w-4 h-4 stroke-[2.5]" />
                  Help & FAQ
                </Button>
              </div>

              {/* Right: Invite Friends */}
              <Button 
                onClick={handleShare}
                variant="default"
                size="lg"
                className="gap-2 md:w-auto shadow-[var(--shadow-glow)]"
              >
                <Share2 className="h-5 w-5" />
                Invite Friends to Pulse
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Controls */}
        {isAdmin && (
          <Card className="bg-gradient-to-br from-muted/30 to-background shadow-sm mb-8">
            <CardContent className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/session/queue")}
                >
                  Session Queue (Admin)
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={() => navigate("/events")}
                  data-tour="events"
                >
                  <CalendarDays className="w-5 h-5 mr-2" />
                  Events
                </Button>

                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={handleRefreshStats}
                  disabled={refreshing || clearing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Recalculate Ratings
                </Button>
              </div>
              
              <Button 
                variant="default" 
                size="lg"
                onClick={() => navigate("/admin")}
                className="w-full mt-4"
              >
                <Settings className="w-4 h-4 mr-2" />
                Admin Dashboard
              </Button>
            </CardContent>
          </Card>
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
