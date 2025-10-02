import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, RefreshCw, HelpCircle, MessageSquare } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo.png";

interface Profile {
  id: string;
  full_name: string;
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

  const handleRefreshStats = async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      // Get the earliest week to recompute from (start of all time)
      const { data: earliestMatch } = await supabase
        .from("matches")
        .select("week_start")
        .order("week_start", { ascending: true })
        .limit(1)
        .single();

      if (earliestMatch?.week_start) {
        // Recompute all ratings from the earliest week using weekly-frozen system
        const { error: recomputeError } = await supabase.rpc('recompute_ratings_from_week', {
          start_week: earliestMatch.week_start
        });

        if (recomputeError) {
          console.error('Recomputation error:', recomputeError);
          toast.error("Failed to recalculate ratings");
          return;
        }
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
      toast.success("Stats recalculated with weekly-frozen system");
    } catch (error) {
      console.error('Refresh error:', error);
      toast.error("Failed to refresh stats");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
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

  const pointDifferential = (profile?.total_points_for || 0) - (profile?.total_points_against || 0);
  
  const weeklyChange = profile 
    ? profile.current_rating - profile.week_start_rating 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2">Welcome back, {profile?.full_name}!</h2>
              <p className="text-muted-foreground">Track your pickleball journey</p>
            </div>
            <div className="text-right">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRefreshStats}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Stats
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Use weekly after matches update
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-2 border-primary shadow-[var(--shadow-glow)]">
            <CardHeader className="pb-3">
              <CardDescription>Official Pulse Score</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">
                {profile?.week_start_rating.toFixed(2)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm">
                <span className="text-muted-foreground">Expected change on refresh: </span>
                <span className={`font-semibold ${weeklyChange > 0 ? 'text-green-500' : weeklyChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)}
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
                Point Differential
              </CardDescription>
              <CardTitle className="text-3xl">
                {pointDifferential > 0 ? "+" : ""}{pointDifferential}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {profile?.total_points_for} for / {profile?.total_points_against} against
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Avg. Opponent Rating</CardDescription>
              <CardTitle className="text-3xl">
                {profile?.avg_opponent_rating.toFixed(2) || "N/A"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Strength of schedule
            </CardContent>
          </Card>
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
          >
            <MessageSquare className="w-5 h-5 mr-2" />
            Court Connector - looking for group
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
      </div>
    </div>
  );
};

export default Dashboard;
