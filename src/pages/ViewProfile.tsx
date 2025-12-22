import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, User, Trophy, Hash, MapPin, Hand, Target, Flame } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { RecentMatches } from "@/components/profile/RecentMatches";
// PlayStyleSnapshot removed per user request
import { HighlightsStrip } from "@/components/profile/HighlightsStrip";

interface Profile {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  current_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
  handedness: string | null;
  play_side: string | null;
  paddle_brand: string | null;
  paddle_model: string | null;
  home_court_id: string | null;
  courts?: {
    id: string;
    name: string;
  } | null;
}

interface RecentMatch {
  id: string;
  team1_players: string[];
  team2_players: string[];
  user_team: number;
  result: 'W' | 'L';
  score: string;
  date: string;
  status?: string;
}


const ViewProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
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

      // Use profiles_public view for viewing other users' profiles to protect PII
      const { data: profileData, error } = await supabase
        .from("profiles_public")
        .select(`
          id,
          display_name,
          first_name,
          last_name,
          avatar_url,
          current_rating,
          total_matches,
          wins,
          losses,
          handedness,
          play_side,
          paddle_brand,
          paddle_model,
          home_court_id,
          courts:home_court_id (
            id,
            name
          )
        `)
        .eq("id", userId)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        navigate("/dashboard");
        return;
      }

      // Fetch recent 10 matches with all participants
      const { data: matchParticipants } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          team,
          matches (
            id,
            team1_score,
            team2_score,
            created_at,
            status
          )
        `)
        .eq("player_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (matchParticipants) {
        const formattedMatches = await Promise.all(
          matchParticipants.map(async (mp: any) => {
            const match = mp.matches;
            if (!match) return null;

            const userTeam = mp.team;
            const won = userTeam === 1 
              ? match.team1_score > match.team2_score
              : match.team2_score > match.team1_score;

            // Get all participants for this match
            const { data: allParticipants } = await supabase
              .from("match_participants")
              .select(`
                player_id,
                team,
                profiles (
                  display_name,
                  first_name,
                  last_name
                )
              `)
              .eq("match_id", match.id);

            const team1Players = (allParticipants || [])
              .filter(p => p.team === 1)
              .map(p => {
                const profile = p.profiles as any;
                return profile?.display_name || 
                  `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                  'Unknown';
              });

            const team2Players = (allParticipants || [])
              .filter(p => p.team === 2)
              .map(p => {
                const profile = p.profiles as any;
                return profile?.display_name || 
                  `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                  'Unknown';
              });

            return {
              id: match.id,
              team1_players: team1Players,
              team2_players: team2Players,
              user_team: userTeam,
              result: won ? 'W' as const : 'L' as const,
              score: `${match.team1_score}-${match.team2_score}`,
              date: match.created_at,
              status: match.status
            };
          })
        );
        setRecentMatches(formattedMatches.filter(Boolean) as RecentMatch[]);
      }

      setProfile(profileData as Profile);
      setLoading(false);
    };

    fetchProfile();
  }, [userId, navigate]);

  // Calculate win streak
  const calculateWinStreak = (matches: RecentMatch[]) => {
    let streak = 0;
    let maxStreak = 0;
    
    const sorted = [...matches].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    
    for (const match of sorted) {
      if (match.result === 'W') {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }
    
    return maxStreak > 0 ? `${maxStreak} wins` : 'No streak yet';
  };

  // Calculate days since last match
  const getDaysSinceLastMatch = () => {
    if (recentMatches.length === 0) return null;
    const lastMatch = new Date(recentMatches[0].date);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastMatch.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground font-sans">Loading...</p>
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

  const highlights = [
    {
      icon: <Flame className="w-6 h-6 text-[#A9CF46]" />,
      label: "Longest Win Streak",
      value: calculateWinStreak(recentMatches),
      subValue: undefined
    },
    {
      icon: <Hash className="w-6 h-6 text-primary" />,
      label: "Total Matches",
      value: String(profile.total_matches),
      subValue: "across all courts"
    }
  ];

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="text-white hover:text-white/90 font-sans font-medium">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Hero Profile Card - Player Banner */}
        <Card className="mb-8 rounded-2xl shadow-lg border-t-4 border-t-[#A9CF46] bg-gradient-to-br from-background via-background to-muted/10 p-8">
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row items-start gap-8">
              {/* Left Column - Avatar + Name + Meta */}
              <div className="flex-none flex flex-col md:flex-row lg:flex-col items-center md:items-start lg:items-center gap-4">
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
                <div className="text-center md:text-left lg:text-center">
                  <h1 className="text-3xl md:text-4xl font-display font-bold tracking-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
                    {displayName}
                  </h1>
                  <div className="flex items-center justify-center md:justify-start lg:justify-center gap-1.5 mb-2">
                    <Trophy className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{profile.current_rating.toFixed(2)} Rating</span>
                  </div>
                  {profile.courts && (
                    <div className="flex items-center justify-center md:justify-start lg:justify-center gap-1.5 text-sm text-muted-foreground font-sans">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Home: {profile.courts.name}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Center Column - Compact Stats */}
              <div className="flex-1 flex flex-col justify-center gap-6 w-full lg:pl-8">
                <div className="flex flex-wrap justify-center lg:justify-start gap-8">
                  <div className="text-center lg:text-left">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 font-sans">PULSE SCORE</p>
                    <p className="text-4xl md:text-5xl font-display font-bold text-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {profile.current_rating?.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-center lg:text-left">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 font-sans">MATCHES</p>
                    <p className="text-2xl md:text-4xl font-display font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {profile.total_matches}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column - Win Rate Dial */}
              <div className="flex-none flex flex-col items-center gap-3">
                <CircularProgressRing percentage={winRate} size={120} strokeWidth={10} />
                <p className="text-xl font-display font-bold text-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {profile.wins}W - {profile.losses}L
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance & Gameplay Card */}
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
          PERFORMANCE & GAMEPLAY
        </h2>
        <Card className="mb-8 rounded-lg shadow-sm border-l-2 border-l-[#A9CF46] p-4 hover:shadow-md transition-shadow">
          <CardContent className="p-0">
            {/* Chip-based info display */}
            <div className="flex flex-wrap gap-2 mb-4">
              {profile.handedness && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 font-sans">
                  <Hand className="w-3.5 h-3.5" />
                  <span className="capitalize">{profile.handedness}</span>
                </Badge>
              )}
              {profile.play_side && (
                <Badge variant="outline" className="gap-1.5 px-3 py-1.5 font-sans">
                  <Target className="w-3.5 h-3.5" />
                  <span className="capitalize">{profile.play_side}-dominant</span>
                </Badge>
              )}
            </div>

            {/* Paddle info */}
            {(profile.paddle_brand || profile.paddle_model) && (
              <p className="text-sm text-muted-foreground font-sans mb-4">
                Paddle: {profile.paddle_brand} {profile.paddle_model}
              </p>
            )}

          </CardContent>
        </Card>

        {/* Highlights Strip */}
        <div className="mb-8">
          <HighlightsStrip highlights={highlights} />
        </div>

        {/* Recent Activity */}
        {recentMatches.length > 0 && (
          <>
            <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground mb-3">
              RECENT ACTIVITY
              {getDaysSinceLastMatch() && (
                <span className="font-sans normal-case"> · Last played {getDaysSinceLastMatch()} days ago</span>
              )}
            </h2>
            <RecentMatches matches={recentMatches} />
          </>
        )}
      </div>
    </div>
  );
};

export default ViewProfile;
