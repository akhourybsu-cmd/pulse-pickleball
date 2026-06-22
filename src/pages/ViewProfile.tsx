import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, User, MapPin, Hand, Target, Flame, Hash } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { resolvePlayerName, didTeamWin } from "@/lib/matchDisplay";
import { HighlightsStrip } from "@/components/profile/HighlightsStrip";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { LastPlayedBadge } from "@/components/profile/LastPlayedBadge";
import { PlayStyleChip } from "@/components/profile/PlayStyleChip";
import { cn } from "@/lib/utils";
import logo from "@/assets/pulse-logo-premium.svg";

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
}

interface RecentMatch {
  id: string;
  match_date: string;
  team1_score: number;
  team2_score: number;
  my_team: 1 | 2;
  won: boolean;
  partner_name: string;
  partner_id: string;
  partner_avatar_url: string | null;
  opponent1_name: string;
  opponent1_id: string;
  opponent1_avatar_url: string | null;
  opponent2_name: string;
  opponent2_id: string;
  opponent2_avatar_url: string | null;
  rating_change: number | null;
  court_name: string;
  source: string | null;
  verified_count: number;
  total_players: number;
  status?: string;
  result: 'W' | 'L';
  date: string;
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
        navigate("/player/dashboard");
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
          paddle_model
        `)
        .eq("id", userId)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        navigate("/player/dashboard");
        return;
      }

      // Fetch recent 10 matches with all participants — same shape as
      // MatchHistory so PremiumMatchCard renders identically.
      const { data: matchParticipants } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          team,
          rating_change,
          matches!inner (
            id,
            match_date,
            team1_score,
            team2_score,
            created_at,
            status,
            source,
            verified_by,
            other_location,
            courts (name)
          )
        `)
        .eq("player_id", userId)
        .eq("matches.status", "approved")
        .order("created_at", { ascending: false, foreignTable: "matches" })
        .limit(10);

      if (matchParticipants && matchParticipants.length > 0) {
        const matchIds = matchParticipants.map((mp: any) => mp.match_id);
        const { data: allParts } = await supabase
          .from("match_participants")
          .select(`
            match_id,
            player_id,
            team,
            profiles (display_name, full_name, first_name, last_name, avatar_url)
          `)
          .in("match_id", matchIds);

        const partsByMatch = (allParts || []).reduce((acc: Record<string, any[]>, p: any) => {
          if (!acc[p.match_id]) acc[p.match_id] = [];
          acc[p.match_id].push(p);
          return acc;
        }, {});

        const formattedMatches: RecentMatch[] = matchParticipants.map((mp: any) => {
          const match = mp.matches;
          const myTeam = mp.team as 1 | 2;
          const parts = partsByMatch[mp.match_id] || [];
          const teammate = parts.find((p) => p.team === myTeam && p.player_id !== userId);
          const opps = parts.filter((p) => p.team !== myTeam);
          const won = didTeamWin(myTeam, match.team1_score, match.team2_score);
          const verifiedBy: string[] = match.verified_by || [];
          const courtName = match.other_location || match.courts?.name || "Unknown Location";

          return {
            id: match.id,
            match_date: match.match_date,
            team1_score: match.team1_score,
            team2_score: match.team2_score,
            my_team: myTeam,
            won,
            partner_name: resolvePlayerName(teammate?.profiles),
            partner_id: teammate?.player_id || "",
            partner_avatar_url: teammate?.profiles?.avatar_url || null,
            opponent1_name: resolvePlayerName(opps[0]?.profiles),
            opponent1_id: opps[0]?.player_id || "",
            opponent1_avatar_url: opps[0]?.profiles?.avatar_url || null,
            opponent2_name: opps[1] ? resolvePlayerName(opps[1].profiles) : "",
            opponent2_id: opps[1]?.player_id || "",
            opponent2_avatar_url: opps[1]?.profiles?.avatar_url || null,
            rating_change: mp.rating_change ?? null,
            court_name: courtName,
            source: match.source ?? null,
            verified_count: verifiedBy.length,
            total_players: parts.length || 4,
            status: match.status,
            result: won ? 'W' : 'L',
            date: match.match_date,
          };
        });
        setRecentMatches(formattedMatches);
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
      {/* PULSE Header */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/player/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-white hover:text-white/90 hover:bg-white/10 font-sans font-medium h-[38px]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </nav>

      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        {/* Premium Hero Card */}
        <div 
          className={cn(
            "rounded-2xl border border-border/50 overflow-hidden",
            "bg-gradient-to-br from-card via-card to-muted/10",
            "dark:from-card dark:via-card dark:to-primary/5",
            "shadow-xl dark:shadow-[0_0_40px_hsl(var(--primary)/0.08)]",
            "opacity-0 animate-fade-up"
          )}
          style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
        >
          {/* Top section with avatar, name, and ring */}
          <div className="p-5 pb-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div 
                className="flex-shrink-0 opacity-0 animate-scale-fade-in"
                style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background ring-primary/60"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-offset-2 ring-offset-background ring-primary/60">
                    <User className="w-10 h-10 text-primary" />
                  </div>
                )}
              </div>

              {/* Name and meta */}
              <div 
                className="flex-1 min-w-0 opacity-0 animate-fade-up"
                style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
              >
                <h1 className="text-2xl font-display font-bold tracking-tight truncate mb-1">
                  {displayName}
                </h1>
                
                {/* Single rating pill */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
                  <span>⭐</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {profile.current_rating.toFixed(2)}
                  </span>
                  <span className="text-primary/70 text-xs">Rating</span>
                </div>

              </div>

              {/* Win Rate Ring */}
              <div 
                className="flex-shrink-0 opacity-0 animate-scale-fade-in"
                style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
              >
                <CircularProgressRing percentage={winRate} size={90} strokeWidth={8} />
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="px-5 pb-5">
            <div className="grid grid-cols-4 gap-2">
              <AnimatedStatChip 
                label="Rating" 
                value={profile.current_rating} 
                decimals={2}
                isPrimary 
                delay={250}
              />
              <AnimatedStatChip 
                label="Matches" 
                value={profile.total_matches} 
                delay={300}
              />
              <AnimatedStatChip 
                label="Win %" 
                value={winRate} 
                suffix="%" 
                decimals={0}
                delay={350}
              />
              <AnimatedStatChip 
                label="Record" 
                value={`${profile.wins}-${profile.losses}`} 
                delay={400}
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
