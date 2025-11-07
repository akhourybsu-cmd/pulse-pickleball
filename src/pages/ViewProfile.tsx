import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { ArrowLeft, User, Trophy, TrendingUp, Share2, Hash, Dumbbell, Calendar } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { PulseScoreBadge } from "@/components/profile/PulseScoreBadge";
import { MiniSparkline } from "@/components/profile/MiniSparkline";
import { RecentMatches } from "@/components/profile/RecentMatches";

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
  home_court_id: string | null;
  courts: {
    id: string;
    name: string;
    city: string;
    state: string;
  } | null;
}

interface RecentMatch {
  id: string;
  opponent_name: string;
  result: 'W' | 'L';
  score: string;
  date: string;
}


const ViewProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [ratingHistory, setRatingHistory] = useState<number[]>([]);
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
          home_court_id,
          courts (
            id,
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

      // Fetch recent matches
      const { data: matchParticipants } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          team,
          matches (
            id,
            team1_score,
            team2_score,
            created_at
          )
        `)
        .eq("player_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);

      if (matchParticipants) {
        const formattedMatches = await Promise.all(
          matchParticipants.map(async (mp: any) => {
            const match = mp.matches;
            if (!match) return null;

            const userTeam = mp.team;
            const won = userTeam === 1 
              ? match.team1_score > match.team2_score
              : match.team2_score > match.team1_score;

            // Get opponent from the other team
            const { data: opponentData } = await supabase
              .from("match_participants")
              .select(`
                player_id,
                profiles (
                  display_name,
                  first_name,
                  last_name
                )
              `)
              .eq("match_id", match.id)
              .neq("team", userTeam)
              .limit(1)
              .single();

            const opponent = opponentData?.profiles as any;
            const opponentName = opponent?.display_name || 
              `${opponent?.first_name || ''} ${opponent?.last_name || ''}`.trim() || 
              'Unknown';

            return {
              id: match.id,
              opponent_name: opponentName,
              result: won ? 'W' as const : 'L' as const,
              score: `${match.team1_score}-${match.team2_score}`,
              date: match.created_at
            };
          })
        );
        setRecentMatches(formattedMatches.filter(Boolean) as RecentMatch[]);
      }

      // Generate mock rating history (last 7 data points)
      const currentRating = profileData.current_rating || profileData.week_start_rating;
      const mockHistory = Array.from({ length: 7 }, (_, i) => {
        const variance = (Math.random() - 0.5) * 0.2;
        return currentRating + variance;
      });
      setRatingHistory(mockHistory);

      setProfile(profileData as Profile);
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
    ? parseFloat(((profile.wins / profile.total_matches) * 100).toFixed(1))
    : 0;

  const weeklyChange = (profile.current_rating || profile.week_start_rating) - profile.week_start_rating;

  const handleShareProfile = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Profile link copied to clipboard!");
  };

  const handleCourtClick = () => {
    if (profile.courts?.id) {
      navigate(`/court-board?court=${profile.courts.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-white hover:text-white/90">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Profile Header */}
        <Card className="mb-8 shadow-[var(--shadow-glow)] bg-gradient-to-br from-background via-background to-muted/10 border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-primary/20"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
                    <User className="w-12 h-12 text-primary" />
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                  <div>
                    <h1 className="text-3xl font-bold mb-1">{displayName}</h1>
                    {profile.phonetic_name && (
                      <p className="text-sm text-muted-foreground">Pronounced: {profile.phonetic_name}</p>
                    )}
                  </div>
                  <Button onClick={handleShareProfile} variant="outline" size="sm" className="self-start md:self-auto">
                    <Share2 className="w-4 h-4 mr-2" />
                    Share Profile
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Pulse Score</p>
                    </div>
                    <div className="pulse-score-container">
                      <p className="text-2xl font-bold text-primary pulse-score-number">
                        {profile.current_rating?.toFixed(2) || profile.week_start_rating.toFixed(2)}
                      </p>
                    </div>
                    <p className={`text-xs mt-1 ${weeklyChange > 0 ? 'text-green-500' : weeklyChange < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)} this week
                    </p>
                    <div className="mt-2">
                      <PulseScoreBadge score={profile.current_rating || profile.week_start_rating} />
                    </div>
                    {ratingHistory.length > 0 && (
                      <div className="mt-3">
                        <MiniSparkline data={ratingHistory} />
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Matches</p>
                    </div>
                    <p className="text-2xl font-bold">{profile.total_matches}</p>
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Trophy className="w-4 h-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                    </div>
                    <div className="mt-2">
                      <CircularProgressRing percentage={winRate} size={70} strokeWidth={6} />
                    </div>
                  </div>
                  
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="cursor-help">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Dumbbell className="w-4 h-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Record</p>
                          </div>
                          <p className="text-2xl font-bold">{profile.wins}W - {profile.losses}L</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">Total wins and losses across all matches</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Headers */}
        <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Performance & Gameplay</h2>

        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Performance Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Points For</span>
                <span className="font-semibold text-lg">{profile.total_points_for}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Points Against</span>
                <span className="font-semibold text-lg">{profile.total_points_against}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Point Differential</span>
                <span className={`font-semibold text-lg ${(profile.total_points_for - profile.total_points_against) > 0 ? 'text-green-500' : 'text-destructive'}`}>
                  {(profile.total_points_for - profile.total_points_against) > 0 ? '+' : ''}
                  {profile.total_points_for - profile.total_points_against}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Gameplay Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {profile.courts && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Home Court</span>
                    <button 
                      onClick={handleCourtClick}
                      className="font-semibold text-right text-primary hover:underline cursor-pointer"
                    >
                      {profile.courts.name}
                    </button>
                  </div>
                  <Separator />
                </>
              )}
              {profile.handedness && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Handedness</span>
                    <span className="font-semibold capitalize">{profile.handedness}</span>
                  </div>
                  <Separator />
                </>
              )}
              {profile.play_side && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Preferred Side</span>
                    <span className="font-semibold capitalize">{profile.play_side}</span>
                  </div>
                  <Separator />
                </>
              )}
              {(profile.paddle_brand || profile.paddle_model) && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Paddle</span>
                  <span className="font-semibold text-right">
                    {profile.paddle_brand} {profile.paddle_model}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Matches */}
        {recentMatches.length > 0 && (
          <>
            <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Recent Activity</h2>
            <RecentMatches matches={recentMatches} />
          </>
        )}
      </div>
    </div>
  );
};

export default ViewProfile;
