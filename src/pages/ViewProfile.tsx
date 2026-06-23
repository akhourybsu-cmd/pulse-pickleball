import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  User as UserIcon,
  Hand,
  Target,
  Flame,
  Hash,
  Share2,
  MessageCircle,
  UserPlus,
  Check,
  ArrowLeft,
  Trophy,
} from "lucide-react";
import { CircularProgressRing } from "@/components/profile/CircularProgressRing";
import { PremiumMatchCard } from "@/components/matches/PremiumMatchCard";
import { resolvePlayerName, didTeamWin } from "@/lib/matchDisplay";
import { HighlightsStrip } from "@/components/profile/HighlightsStrip";
import { AnimatedStatChip } from "@/components/profile/AnimatedStatChip";
import { LastPlayedBadge } from "@/components/profile/LastPlayedBadge";
import { PlayStyleChip } from "@/components/profile/PlayStyleChip";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { useFriends } from "@/hooks/useFriends";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";

interface Profile {
  id: string;
  display_name: string | null;
  full_name: string | null;
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
  result: "W" | "L";
  date: string;
}

const ViewProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { userId } = useParams<{ userId: string }>();
  const { getFriendshipStatus, sendFriendRequest } = useFriends();

  // Self-redirect: own profile lives at /player/profile (command center).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setCurrentUserId(user?.id ?? null);
      if (user?.id && userId && user.id === userId) {
        navigate("/player/profile", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        toast.error("Invalid user ID");
        navigate(-1);
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles_public")
        .select(`
          id, display_name, full_name, first_name, last_name, avatar_url,
          current_rating, total_matches, wins, losses,
          handedness, play_side, paddle_brand, paddle_model
        `)
        .eq("id", userId)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        navigate(-1);
        return;
      }

      const { data: matchParticipants } = await supabase
        .from("match_participants")
        .select(`
          match_id, team, rating_change,
          matches!inner (
            id, match_date, team1_score, team2_score,
            created_at, status, source, verified_by,
            other_location, courts (name)
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
            match_id, player_id, team,
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
            result: won ? "W" : "L",
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

  const displayName = useMemo(() => {
    if (!profile) return "Player";
    return (
      profile.display_name ||
      (profile.first_name && profile.last_name
        ? `${profile.first_name} ${profile.last_name}`
        : "Player")
    );
  }, [profile]);

  const winRate = profile && profile.total_matches > 0
    ? parseFloat(((profile.wins / profile.total_matches) * 100).toFixed(1))
    : 0;

  const winStreak = useMemo(() => {
    let streak = 0;
    let maxStreak = 0;
    const sorted = [...recentMatches].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    for (const m of sorted) {
      if (m.result === "W") {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }
    return maxStreak > 0 ? `${maxStreak} wins` : "No streak";
  }, [recentMatches]);

  const daysSinceLast = useMemo(() => {
    if (recentMatches.length === 0) return null;
    const last = new Date(recentMatches[0].date);
    return Math.ceil(Math.abs(Date.now() - last.getTime()) / (1000 * 60 * 60 * 24));
  }, [recentMatches]);

  const friendshipStatus = userId ? getFriendshipStatus(userId) : "none";
  const isFriend = friendshipStatus === "accepted";
  const isSelf = currentUserId && userId && currentUserId === userId;

  const handleShare = async () => {
    if (!profile) return;
    const url = `${window.location.origin}/profile/${profile.id}`;
    const shareText = `Check out ${displayName} on PULSE Pickleball`;
    try {
      const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share({ title: shareText, url });
        return;
      }
    } catch { /* fallthrough */ }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleMessage = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.rpc("get_or_create_dm_conversation", {
        other_user_id: userId,
      });
      if (error) throw error;
      navigate(`/player/messages/${data}`);
    } catch {
      navigate(`/player/messages`);
    }
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

  if (!profile) return null;

  const subtitle = "PULSE Player";

  const highlights = [
    {
      icon: <Flame className="w-5 h-5 text-primary" />,
      label: "Win Streak",
      value: winStreak,
      subValue: "longest recorded",
    },
    {
      icon: <Hash className="w-5 h-5 text-primary" />,
      label: "Total Matches",
      value: String(profile.total_matches),
      subValue: "across all courts",
    },
  ];

  return (
    <div className="min-h-screen bg-background pb-12">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="container mx-auto px-4 py-3 max-w-3xl flex items-center justify-between relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="h-9 text-muted-foreground -ml-2 z-10"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-secondary-foreground">
            <Logo className="h-[44px] w-auto" />
          </div>
          <div className="w-16" />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-5 max-w-3xl space-y-7">
        {/* Hero card — matches PlayerIdentityCard / Profile card system */}
        <div
          className={cn(
            "rounded-2xl border border-border/60 bg-card overflow-hidden",
            "bg-gradient-to-br from-card via-card to-primary/[0.04]",
            "shadow-[0_4px_24px_-12px_hsl(var(--primary)/0.25)]",
            "opacity-0 animate-fade-up",
          )}
          style={{ animationDelay: "0ms", animationFillMode: "forwards" }}
        >
          <div className="p-6">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={displayName}
                    className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2 ring-offset-background ring-primary/60"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-offset-2 ring-offset-background ring-primary/60">
                    <UserIcon className="w-10 h-10 text-primary" />
                  </div>
                )}
              </div>

              {/* Name + rating pill */}
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-display font-semibold tracking-tight truncate leading-tight">
                  {displayName}
                </h2>
                {(profile.full_name || (profile.first_name && profile.last_name)) && (
                  <p className="text-sm text-muted-foreground truncate mt-0.5">
                    {profile.full_name || `${profile.first_name} ${profile.last_name}`}
                  </p>
                )}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mt-2">
                  <Trophy className="w-3.5 h-3.5" />
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {profile.current_rating.toFixed(2)}
                  </span>
                  <span className="text-primary/70 text-xs">Rating</span>
                </div>
                {daysSinceLast != null && (
                  <div className="mt-2">
                    <LastPlayedBadge days={daysSinceLast} />
                  </div>
                )}
              </div>

              {/* Win-rate ring */}
              <div className="flex-shrink-0">
                <CircularProgressRing percentage={winRate} size={84} strokeWidth={8} />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 mt-6">
              <AnimatedStatChip label="Rating" value={profile.current_rating} decimals={2} isPrimary delay={150} />
              <AnimatedStatChip label="Matches" value={profile.total_matches} delay={200} />
              <AnimatedStatChip label="Win %" value={winRate} suffix="%" decimals={0} delay={250} />
              <AnimatedStatChip label="Record" value={`${profile.wins}-${profile.losses}`} delay={300} />
            </div>
          </div>
        </div>

        {/* Action row */}
        {!isSelf && (
          <div
            className="grid grid-cols-2 gap-3 opacity-0 animate-fade-up"
            style={{ animationDelay: "120ms", animationFillMode: "forwards" }}
          >
            {isFriend ? (
              <Button onClick={handleMessage} className="h-11 gap-2 font-medium">
                <MessageCircle className="h-4 w-4" />
                Message
              </Button>
            ) : friendshipStatus === "pending_sent" ? (
              <Button disabled variant="secondary" className="h-11 gap-2">
                <Check className="h-4 w-4" />
                Request sent
              </Button>
            ) : (
              <Button
                onClick={() => userId && sendFriendRequest(userId)}
                className="h-11 gap-2 font-medium"
              >
                <UserPlus className="h-4 w-4" />
                Add friend
              </Button>
            )}
            <Button onClick={handleShare} variant="outline" className="h-11 gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        )}

        {/* Play style */}
        {(profile.handedness || profile.play_side) && (
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: "180ms", animationFillMode: "forwards" }}
          >
            <SectionHeader label="Play Style" />
            <div className="flex flex-wrap gap-2">
              {profile.handedness && (
                <PlayStyleChip
                  icon={<Hand className="w-4 h-4" />}
                  label={profile.handedness}
                  description={`This player uses their ${profile.handedness.toLowerCase()} hand as their dominant hand.`}
                />
              )}
              {profile.play_side && (
                <PlayStyleChip
                  icon={<Target className="w-4 h-4" />}
                  label={`${profile.play_side}-dominant`}
                  description={`This player typically plays on the ${profile.play_side.toLowerCase()} side of the court.`}
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

        {/* Highlights */}
        <div
          className="opacity-0 animate-fade-up"
          style={{ animationDelay: "240ms", animationFillMode: "forwards" }}
        >
          <SectionHeader label="Highlights" />
          <HighlightsStrip highlights={highlights} />
        </div>

        {/* Recent matches */}
        <div
          className="opacity-0 animate-fade-up"
          style={{ animationDelay: "300ms", animationFillMode: "forwards" }}
        >
          <SectionHeader label="Recent matches" count={recentMatches.length} />
          {recentMatches.length === 0 ? (
            <div className="rounded-2xl border border-border/60 bg-card p-8 text-center">
              <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Hash className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No matches yet.</p>
            </div>
          ) : (
            <>
              {/* W/L streak dots */}
              <div className="flex gap-1.5 mb-3 overflow-x-auto scrollbar-hide">
                {recentMatches.map((m) => (
                  <div
                    key={`dot-${m.id}`}
                    className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                      m.won
                        ? "bg-primary text-primary-foreground"
                        : "bg-destructive/80 text-destructive-foreground",
                    )}
                  >
                    {m.won ? "W" : "L"}
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {recentMatches.map((m) => (
                  <PremiumMatchCard
                    key={m.id}
                    perspective="other"
                    matchId={m.id}
                    matchDate={m.match_date}
                    team1Score={m.team1_score}
                    team2Score={m.team2_score}
                    myTeam={m.my_team}
                    won={m.won}
                    playerName={displayName}
                    playerAvatarUrl={profile.avatar_url}
                    partnerName={m.partner_name}
                    partnerId={m.partner_id}
                    partnerAvatarUrl={m.partner_avatar_url}
                    opponent1Name={m.opponent1_name}
                    opponent1Id={m.opponent1_id}
                    opponent1AvatarUrl={m.opponent1_avatar_url}
                    opponent2Name={m.opponent2_name}
                    opponent2Id={m.opponent2_id}
                    opponent2AvatarUrl={m.opponent2_avatar_url}
                    ratingChange={m.rating_change}
                    courtName={m.court_name}
                    source={m.source}
                    verifiedCount={m.verified_count}
                    totalPlayers={m.total_players}
                    isCurrentUserVerified={false}
                    showVerifyActions={false}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewProfile;
