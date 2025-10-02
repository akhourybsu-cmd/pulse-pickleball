import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, RefreshCw, HelpCircle, MessageSquare, Trash2, Award, UserCog, User as UserIcon, Settings } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo-new.png";
import { CourtStats } from "@/components/CourtStats";
import { BadgeDisplay } from "@/components/BadgeDisplay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

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
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        toast.error("Failed to load profile");
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
  const pointDifferentialPerMatch = profile && profile.total_matches > 0
    ? (totalPointDifferential / profile.total_matches).toFixed(2)
    : "0.00";
  
  const weeklyChange = profile 
    ? profile.current_rating - profile.week_start_rating 
    : 0;

  return (
    <div className="min-h-screen bg-background">
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
            <Button variant="outline" size="icon" onClick={() => navigate(`/profile/${user?.id}`)} className="rounded-full">
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
            <div>
              <h2 className="text-3xl font-bold mb-2">Welcome back, {profile?.display_name || profile?.full_name}!</h2>
              <p className="text-muted-foreground">Track your pickleball journey</p>
            </div>
            <div className="text-right space-y-2">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRefreshStats}
                  disabled={refreshing || clearing}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Recalculate Ratings
                </Button>
                
                {user?.email === 'akhourybsu@gmail.com' && (
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={handleClearHistory}
                    disabled={refreshing || clearing}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear History
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {user?.email === 'akhourybsu@gmail.com' ? 'Admin tools' : 'Recalculate all player ratings'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-2 border-primary shadow-[var(--shadow-glow)]">
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

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Trophy className="w-4 h-4" />
                Total Matches
              </CardDescription>
              <CardTitle className="text-4xl">{profile?.total_matches}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Win Rate
              </CardDescription>
              <CardTitle className="text-4xl">{winRate}%</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Record</CardDescription>
              <CardTitle className="text-4xl">
                {profile?.wins}W - {profile?.losses}L
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Point Differential (Per Match)
              </CardDescription>
              <CardTitle className="text-3xl">
                {parseFloat(pointDifferentialPerMatch) > 0 ? "+" : ""}{pointDifferentialPerMatch}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Total: {totalPointDifferential > 0 ? "+" : ""}{totalPointDifferential} ({profile?.total_points_for} for / {profile?.total_points_against} against)
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg. Opponent Rating</CardDescription>
              <CardTitle className="text-3xl">
                {profile?.avg_opponent_rating?.toFixed(2) || "N/A"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Strength of schedule
            </CardContent>
          </Card>
        </div>

        <div className="mb-8">
          {user && <CourtStats userId={user.id} />}
        </div>

        <div className="mb-8">
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
          <Button 
            size="lg" 
            onClick={() => navigate("/match/new")}
            className="shadow-[var(--shadow-glow)]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Record New Match
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
            onClick={() => navigate("/match/history")}
          >
            <Calendar className="w-5 h-5 mr-2" />
            My Match History
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/court/history")}
          >
            <MapPin className="w-5 h-5 mr-2" />
            Court History
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/court/board")}
            className="relative"
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Court Connector - looking for group
            {hasNewParticipants && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
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
            onClick={() => navigate("/faq")}
          >
            <HelpCircle className="w-5 h-5 mr-2" />
            Help & FAQ
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            onClick={() => navigate("/session/queue")}
          >
            Session Queue
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
