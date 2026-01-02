import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, User, MapPin, Hand, Target, Flame, Hash, Trophy } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { RecentMatches } from "@/components/profile/RecentMatches";
import { HighlightsStrip } from "@/components/profile/HighlightsStrip";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { LastPlayedBadge } from "@/components/profile/LastPlayedBadge";
import { PlayStyleChip } from "@/components/profile/PlayStyleChip";
import { cn } from "@/lib/utils";
import logo from "@/assets/pulse-logo-new.png";

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
    
    return maxStreak > 0 ? `${maxStreak} wins` : 'No streak';
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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading profile...</p>
        </div>
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
      icon: <Flame className="w-5 h-5 text-primary" />,
      label: "Win Streak",
      value: calculateWinStreak(recentMatches),
      subValue: "longest recorded"
    },
    {
      icon: <Hash className="w-5 h-5 text-primary" />,
      label: "Total Matches",
      value: String(profile.total_matches),
      subValue: "across all courts"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Sticky Header */}
      <nav className="sticky top-0 z-50 bg-secondary border-b border-secondary-foreground/10 shadow-sm backdrop-blur-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 flex items-center justify-between h-[72px]">
          <Link to="/dashboard" className="flex-shrink-0">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-10 sm:h-12 w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(-1)} 
              className="text-white hover:text-white/90 hover:bg-white/10 active:scale-[0.97] active:opacity-80 transition-all duration-150"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      <div className="px-4 py-5 max-w-lg mx-auto space-y-5">
        {/* Premium Hero Card - Player Trading Card Feel */}
        <div 
          className={cn(
            "rounded-2xl border border-border/40 overflow-hidden",
            "bg-gradient-to-br from-card via-card to-muted/20",
            "dark:from-card dark:via-card/95 dark:to-primary/5",
            "shadow-xl dark:shadow-[0_0_50px_hsl(var(--primary)/0.1)]",
            "opacity-0 animate-hero-enter"
          )}
          style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
        >
          {/* Top section - compact and premium */}
          <div className="p-4 pb-3">
            <div className="flex items-start gap-3">
              {/* Avatar with gradient ring */}
              <div 
                className="flex-shrink-0 relative opacity-0 animate-scale-fade-in"
                style={{ animationDelay: '80ms', animationFillMode: 'forwards' }}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-primary/60 to-teal-400 p-[3px]">
                  <div className="w-full h-full rounded-full bg-background" />
                </div>
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="relative w-[72px] h-[72px] rounded-full object-cover ring-[3px] ring-transparent"
                    style={{ 
                      background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.6), hsl(174 60% 50%)) border-box',
                      border: '3px solid transparent',
                      backgroundClip: 'padding-box'
                    }}
                  />
                ) : (
                  <div className="relative w-[72px] h-[72px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border-[3px] border-primary/40">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                )}
              </div>

              {/* Name, rating pill, and location */}
              <div 
                className="flex-1 min-w-0 pt-1 opacity-0 animate-fade-up"
                style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
              >
                <h1 className="text-xl font-display font-bold tracking-tight truncate mb-1.5">
                  {displayName}
                </h1>
                
                {/* Compact rating pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/15 dark:bg-primary/20 text-primary text-sm font-semibold mb-2 shadow-sm">
                  <Trophy className="w-3.5 h-3.5" />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {profile.current_rating.toFixed(2)}
                  </span>
                </div>

                {/* Home court */}
                {profile.courts && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{profile.courts.name}</span>
                  </div>
                )}
              </div>

              {/* Win Rate Ring - Smaller & Premium */}
              <div 
                className="flex-shrink-0 opacity-0 animate-stat-pop"
                style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
              >
                <CircularProgressRing 
                  percentage={winRate} 
                  size={72} 
                  strokeWidth={7} 
                />
              </div>
            </div>
          </div>

          {/* Stats Row - 3 columns (removed redundant Rating) */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <AnimatedStatChip 
                label="Matches" 
                value={profile.total_matches}
                isPrimary
                delay={240}
              />
              <AnimatedStatChip 
                label="Win %" 
                value={winRate} 
                suffix="%" 
                decimals={0}
                delay={280}
              />
              <AnimatedStatChip 
                label="Record" 
                value={`${profile.wins}-${profile.losses}`} 
                delay={320}
              />
            </div>
          </div>
        </div>

        {/* Play Style Chips */}
        {(profile.handedness || profile.play_side) && (
          <div 
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
          >
            <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Play Style
            </h2>
            <div className="flex flex-wrap gap-2">
              {profile.handedness && (
                <PlayStyleChip 
                  icon={<Hand className="w-4 h-4" />}
                  label={profile.handedness}
                  description={`This player uses their ${profile.handedness.toLowerCase()} hand as their dominant hand for shots and serves.`}
                />
              )}
              {profile.play_side && (
                <PlayStyleChip 
                  icon={<Target className="w-4 h-4" />}
                  label={`${profile.play_side}-dominant`}
                  description={`This player typically plays on the ${profile.play_side.toLowerCase()} side of the court in doubles matches.`}
                />
              )}
            </div>
            {(profile.paddle_brand || profile.paddle_model) && (
              <p className="text-xs text-muted-foreground mt-3">
                Paddle: {profile.paddle_brand} {profile.paddle_model}
              </p>
            )}
          </div>
        )}

        {/* Highlights Strip */}
        <div 
          className="opacity-0 animate-fade-up"
          style={{ animationDelay: '350ms', animationFillMode: 'forwards' }}
        >
          <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            Key Highlights
          </h2>
          <HighlightsStrip highlights={highlights} />
        </div>

        {/* Recent Activity */}
        {recentMatches.length > 0 && (
          <div 
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '450ms', animationFillMode: 'forwards' }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Recent Activity
              </h2>
              <LastPlayedBadge days={getDaysSinceLastMatch()} />
            </div>
            <RecentMatches matches={recentMatches} />
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
};

export default ViewProfile;
