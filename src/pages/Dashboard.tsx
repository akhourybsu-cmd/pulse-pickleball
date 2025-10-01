import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, TrendingUp, Calendar, LogOut, Plus, MapPin, BarChart3, Share2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo.png";
import { ShareableStatsCard } from "@/components/ShareableStatsCard";
import { downloadCardAsImage } from "@/utils/shareUtils";

interface Profile {
  id: string;
  full_name: string;
  current_rating: number;
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
  const navigate = useNavigate();
  const statsCardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleShareStats = async () => {
    if (!statsCardRef.current || !profile) return;
    
    setIsGeneratingImage(true);
    try {
      await downloadCardAsImage(
        statsCardRef.current,
        `pulse-stats-${profile.full_name.replace(/\s+/g, "-")}.png`
      );
      toast.success("Stats card downloaded!");
    } catch (error) {
      toast.error("Failed to generate image");
    } finally {
      setIsGeneratingImage(false);
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

  const pointDifferential = (profile?.total_points_for || 0) - (profile?.total_points_against || 0);

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
          <h2 className="text-3xl font-bold mb-2">Welcome back, {profile?.full_name}!</h2>
          <p className="text-muted-foreground">Track your pickleball journey</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card className="border-2 border-primary shadow-[var(--shadow-glow)]">
            <CardHeader className="pb-3">
              <CardDescription>Current Rating</CardDescription>
              <CardTitle className="text-5xl font-bold text-primary">
                {profile?.current_rating.toFixed(2)}
              </CardTitle>
            </CardHeader>
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            onClick={handleShareStats}
            disabled={isGeneratingImage}
          >
            <Share2 className="w-5 h-5 mr-2" />
            {isGeneratingImage ? "Generating..." : "Share Stats"}
          </Button>
        </div>

        {/* Hidden shareable card for image generation */}
        <div className="fixed -left-[9999px] -top-[9999px]">
          {profile && (
            <ShareableStatsCard
              cardRef={statsCardRef}
              playerName={profile.full_name}
              currentRating={profile.current_rating}
              totalMatches={profile.total_matches}
              wins={profile.wins}
              losses={profile.losses}
              winRate={winRate}
              pointDifferential={pointDifferential}
              avgOpponentRating={profile.avg_opponent_rating}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
