import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, User, Trophy, TrendingUp, Award } from "lucide-react";
import logo from "@/assets/pulse-logo.png";
import { BadgeDisplay } from "@/components/BadgeDisplay";

interface Profile {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phonetic_name: string | null;
  current_rating: number;
  week_start_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
  total_points_for: number;
  total_points_against: number;
  handedness: string | null;
  play_side: string | null;
  paddle_brand: string | null;
  paddle_model: string | null;
  courts: {
    name: string;
    city: string;
    state: string;
  } | null;
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

const ViewProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<PlayerBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        toast.error("Invalid user ID");
        navigate("/dashboard");
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select(`
          id,
          display_name,
          first_name,
          last_name,
          avatar_url,
          phonetic_name,
          current_rating,
          week_start_rating,
          total_matches,
          wins,
          losses,
          total_points_for,
          total_points_against,
          handedness,
          play_side,
          paddle_brand,
          paddle_model,
          courts (
            name,
            city,
            state
          )
        `)
        .eq("id", userId)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        navigate("/dashboard");
        return;
      }

      setProfile(profileData as Profile);

      // Fetch badges
      const { data: badgeData } = await supabase
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
        .eq('player_id', userId)
        .order('earned_at', { ascending: false });

      if (badgeData) {
        setBadges(badgeData as PlayerBadge[]);
      }

      setLoading(false);
    };

    fetchProfile();
  }, [userId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const displayName = profile.display_name || 
    (profile.first_name && profile.last_name 
      ? `${profile.first_name} ${profile.last_name}`
      : "Player");

  const winRate = profile.total_matches > 0
    ? ((profile.wins / profile.total_matches) * 100).toFixed(1)
    : "0.0";

  const weeklyChange = profile.current_rating - profile.week_start_rating;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-12 h-12 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{displayName}</h1>
                {profile.phonetic_name && (
                  <p className="text-sm text-muted-foreground mb-4">Pronounced: {profile.phonetic_name}</p>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pulse Score</p>
                    <p className="text-2xl font-bold text-primary">{profile.current_rating.toFixed(2)}</p>
                    <p className={`text-xs ${weeklyChange > 0 ? 'text-green-500' : weeklyChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)} this week
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Matches</p>
                    <p className="text-2xl font-bold">{profile.total_matches}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{winRate}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Record</p>
                    <p className="text-2xl font-bold">{profile.wins}W - {profile.losses}L</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Performance Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Points For</span>
                <span className="font-semibold">{profile.total_points_for}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Points Against</span>
                <span className="font-semibold">{profile.total_points_against}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Point Differential</span>
                <span className={`font-semibold ${(profile.total_points_for - profile.total_points_against) > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {(profile.total_points_for - profile.total_points_against) > 0 ? '+' : ''}
                  {profile.total_points_for - profile.total_points_against}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Gameplay Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.courts && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Home Court</span>
                    <span className="font-semibold text-right">{profile.courts.name}</span>
                  </div>
                  <Separator />
                </>
              )}
              {profile.handedness && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Handedness</span>
                    <span className="font-semibold capitalize">{profile.handedness}</span>
                  </div>
                  <Separator />
                </>
              )}
              {profile.play_side && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Preferred Side</span>
                    <span className="font-semibold capitalize">{profile.play_side}</span>
                  </div>
                  <Separator />
                </>
              )}
              {(profile.paddle_brand || profile.paddle_model) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Paddle</span>
                  <span className="font-semibold text-right">
                    {profile.paddle_brand} {profile.paddle_model}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
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
        )}
      </div>
    </div>
  );
};

export default ViewProfile;
