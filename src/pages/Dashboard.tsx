import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, RefreshCw, HelpCircle, MessageSquare, Trash2, Award, UserCog, User as UserIcon, Settings, Share2, CalendarDays } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo-new.png";
import { CourtStats } from "@/components/CourtStats";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";

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

interface PlayerBadge {
  id: string;
  earned_at: string;
  badges: {
    id: string;
    code: string;
    name: string;
    description: string;
    category: string;
    tier: number;
  };
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [hasNewParticipants, setHasNewParticipants] = useState(false);
  const [badges, setBadges] = useState<PlayerBadge[]>([]);
  const [calculatingBadges, setCalculatingBadges] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

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

        const { data: profileData, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Profile fetch error:", error);
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileData);

        // Check if user is admin
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (roleData) {
          setIsAdmin(true);
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

  // Real-time updates for profile changes
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('profile-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        (payload) => {
          setProfile(payload.new as Profile);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Fetch player badges
  useEffect(() => {
    if (!user?.id) return;

    const fetchBadges = async () => {
      const { data: badgeData, error } = await supabase
        .from('player_badges')
        .select(`
          id,
          earned_at,
          badges (
            id,
            code,
            name,
            description,
            category,
            tier
          )
        `)
        .eq('player_id', user.id)
        .order('earned_at', { ascending: false });

      if (!error && badgeData) {
        setBadges(badgeData as PlayerBadge[]);
      }
    };

    fetchBadges();
  }, [user?.id]);

  // Check for new participants in user's posts
  useEffect(() => {
    if (!user?.id) return;

    const checkNewParticipants = async () => {
      const { data: posts } = await supabase
        .from("court_posts")
        .select(`
          id,
          viewed_participants_count,
          court_post_participants(count)
        `)
        .eq("user_id", user.id)
        .eq("status", "open");

      if (posts) {
        const hasNew = posts.some((post: any) => {
          const currentCount = post.court_post_participants[0]?.count || 0;
          const viewedCount = post.viewed_participants_count || 0;
          return currentCount > viewedCount;
        });
        setHasNewParticipants(hasNew);
      }
    };

    checkNewParticipants();

    // Listen for new participants
    const channel = supabase
      .channel('participant-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_post_participants'
        },
        () => {
          checkNewParticipants();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

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

  const calculateBadges = async () => {
    if (!user?.id) return;
    
    setCalculatingBadges(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-badges', {
        body: { player_id: user.id }
      });

      if (error) {
        console.error('Badge calculation error:', error);
        toast.error("Failed to calculate badges");
        return;
      }

      // Refresh badges
      const { data: badgeData, error: fetchError } = await supabase
        .from('player_badges')
        .select(`
          id,
          earned_at,
          badges (
            id,
            code,
            name,
            description,
            category,
            tier
          )
        `)
        .eq('player_id', user.id)
        .order('earned_at', { ascending: false });

      if (!fetchError && badgeData) {
        setBadges(badgeData as PlayerBadge[]);
        toast.success(`Badge check complete! ${data.badgesAwarded} badges awarded.`);
      }
    } catch (error) {
      console.error('Badge calculation error:', error);
      toast.error("Failed to calculate badges");
    } finally {
      setCalculatingBadges(false);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pulse Pickleball',
      text: 'Join me on Pulse - Track your pickleball journey and compete with friends!',
      url: window.location.origin
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Thanks for spreading the word!");
      } else {
        await navigator.clipboard.writeText(window.location.origin);
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
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button variant="default" size="sm" onClick={() => navigate("/admin")}>
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
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
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">Welcome back, {profile?.display_name || profile?.full_name}!</h2>
              <p className="text-muted-foreground mb-4">Track your pickleball journey</p>
              
              <div className="space-y-3 w-full md:w-auto">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/match/new")}
                  className="shadow-[var(--shadow-glow)] w-full md:w-auto"
                  data-tour="record-match"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Record New Match
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => navigate("/court/board")}
                    className="relative flex flex-col items-start py-3 h-auto"
                  >
                    <div className="flex items-center w-full">
                      <MessageSquare className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm">Court Connector</span>
                      {hasNewParticipants && (
                        <span className="absolute top-2 right-2 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">Find a group near you</span>
                  </Button>

                  <Button 
                    size="lg" 
                    variant="outline"
                    onClick={() => navigate("/match/history")}
                    className="flex flex-col items-start py-3 h-auto"
                    data-tour="match-history"
                  >
                    <div className="flex items-center w-full">
                      <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm">Match History</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">View your matches</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <Card className="border-2 border-primary shadow-[var(--shadow-glow)]" data-tour="pulse-score">
            <CardHeader className="pb-3">
              <CardDescription>Live Pulse Score</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">
                {profile?.current_rating?.toFixed(2) || '3.00'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm">
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

          <div className="grid grid-cols-2 gap-4">
            <Card className="py-2">
              <CardHeader className="pb-2 pt-3">
                <CardDescription className="text-xs">Record</CardDescription>
                <CardTitle className="text-3xl">
                  {profile?.wins}W - {profile?.losses}L
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground pb-3">
                {profile?.total_matches} {profile?.total_matches === 1 ? 'match' : 'matches'} played
              </CardContent>
            </Card>

            <Card className="py-2">
              <CardHeader className="pb-2 pt-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <TrendingUp className="w-3 h-3" />
                  Win Rate
                </CardDescription>
                <CardTitle className="text-3xl">{winRate}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="py-2">
              <CardHeader className="pb-2 pt-3">
                <CardDescription className="flex items-center gap-2 text-xs">
                  <BarChart3 className="w-3 h-3" />
                  Point Diff / Game
                </CardDescription>
                <CardTitle className="text-3xl">
                  {parseFloat(pointDifferentialPerGame) > 0 ? "+" : ""}{pointDifferentialPerGame}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground pb-3">
                For: {profile?.total_points_for || 0} • Against: {profile?.total_points_against || 0}
              </CardContent>
            </Card>

            <Card className="py-2">
              <CardHeader className="pb-2 pt-3">
                <CardDescription className="text-xs">Avg. Opponent Rating</CardDescription>
                <CardTitle className="text-3xl">
                  {profile?.avg_opponent_rating?.toFixed(2) || "N/A"}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground pb-3">
                Strength of schedule
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-8">
          {user && <CourtStats userId={user.id} />}
        </div>

        <div className="mb-8" data-tour="badges">
          <BadgeDisplay badges={badges.map(b => ({
            id: b.badges.id,
            code: b.badges.code,
            name: b.badges.name,
            description: b.badges.description,
            category: b.badges.category,
            tier: b.badges.tier,
            earned_at: b.earned_at
          }))} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">


          {isAdmin && (
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/session/queue")}
            >
              Session Queue (Admin)
            </Button>
          )}

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
            size="lg" 
            variant="outline"
            onClick={() => navigate("/court/history")}
            data-tour="leaderboard"
          >
            <MapPin className="w-5 h-5 mr-2" />
            Court History
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={calculateBadges}
            disabled={calculatingBadges}
          >
            {calculatingBadges ? (
              <>
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Calculating Badges...
              </>
            ) : (
              <>
                <Award className="w-5 h-5 mr-2" />
                Check for New Badges
              </>
            )}
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/profile/edit")}
          >
            <UserCog className="w-5 h-5 mr-2" />
            Edit Profile
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/faq")}
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            Help & FAQ
          </Button>
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

        {/* Admin Only - Recalculate Ratings */}
        {isAdmin && (
          <div className="flex justify-center mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefreshStats}
              disabled={refreshing || clearing}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Recalculate Ratings
            </Button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
