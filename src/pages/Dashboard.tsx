import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { LogOut, User as UserIcon, Trophy } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo-new.png";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import { SmartMatch } from "@/components/court/SmartMatch";
import { LFGNotifications } from "@/components/court/LFGNotifications";
import { MFAPrompt } from "@/components/auth/MFAPrompt";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationDrawer, Notification } from "@/components/NotificationDrawer";

// New Pulse 2.0 Dashboard Components
import { PulseScoreCard } from "@/components/dashboard/PulseScoreCard";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { ActivityModule } from "@/components/dashboard/ActivityModule";
import { StatsByCourtCard } from "@/components/dashboard/StatsByCourtCard";
import { SpacesPreviewRow } from "@/components/dashboard/SpacesPreviewRow";
import { HomeFooterUtilities } from "@/components/dashboard/HomeFooterUtilities";

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

interface PartnerOpponentData {
  playerId: string;
  playerName: string;
  matchCount: number;
}

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  // Notification state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [homeCourtId, setHomeCourtId] = useState<string | null>(null);
  
  // Partner/Opponent stats
  const [mostPlayedPartner, setMostPlayedPartner] = useState<PartnerOpponentData | null>(null);
  const [mostFacedOpponent, setMostFacedOpponent] = useState<PartnerOpponentData | null>(null);

  const unreadCount = notifications.filter(n => n.unread).length;

  const fetchPartnerOpponentStats = async (userId: string) => {
    try {
      // Get all matches the user participated in
      const { data: userMatches, error: matchError } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          team,
          matches!inner (id, status)
        `)
        .eq("player_id", userId)
        .eq("matches.status", "approved");

      if (matchError || !userMatches?.length) return;

      const matchIds = userMatches.map(m => m.match_id);
      const userTeamMap = new Map(userMatches.map(m => [m.match_id, m.team]));

      // Get all participants for these matches
      const { data: allParticipants, error: participantsError } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          player_id,
          team,
          profiles:player_id (display_name, first_name, last_name, full_name)
        `)
        .in("match_id", matchIds)
        .neq("player_id", userId);

      if (participantsError || !allParticipants) return;

      // Count partners (same team) and opponents (different team)
      const partnerCounts: Record<string, { count: number; name: string }> = {};
      const opponentCounts: Record<string, { count: number; name: string }> = {};

      allParticipants.forEach(p => {
        const userTeam = userTeamMap.get(p.match_id);
        const profile = p.profiles as any;
        const name = profile?.display_name || profile?.full_name || 
          `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Unknown';
        
        if (p.team === userTeam) {
          // Partner
          if (!partnerCounts[p.player_id]) {
            partnerCounts[p.player_id] = { count: 0, name };
          }
          partnerCounts[p.player_id].count++;
        } else {
          // Opponent
          if (!opponentCounts[p.player_id]) {
            opponentCounts[p.player_id] = { count: 0, name };
          }
          opponentCounts[p.player_id].count++;
        }
      });

      // Find top partner
      const topPartner = Object.entries(partnerCounts)
        .sort((a, b) => b[1].count - a[1].count)[0];
      
      if (topPartner) {
        setMostPlayedPartner({
          playerId: topPartner[0],
          playerName: topPartner[1].name,
          matchCount: topPartner[1].count
        });
      }

      // Find top opponent
      const topOpponent = Object.entries(opponentCounts)
        .sort((a, b) => b[1].count - a[1].count)[0];
      
      if (topOpponent) {
        setMostFacedOpponent({
          playerId: topOpponent[0],
          playerName: topOpponent[1].name,
          matchCount: topOpponent[1].count
        });
      }
    } catch (error) {
      console.error("Error fetching partner/opponent stats:", error);
    }
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session?.user) {
          console.log("No valid session, redirecting to auth");
          navigate("/auth");
          return;
        }

        const user = session.user;
        setUser(user);

        // Fetch all data in parallel for faster loading
        const [profileResult, roleResult, publicProfileResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle(),
          supabase.from("profiles_public").select("home_court_id").eq("id", user.id).single()
        ]);

        if (profileResult.error) {
          console.error("Profile fetch error:", profileResult.error);
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data);
        setIsAdmin(!!roleResult.data);

        // Set home court info if available
        if (publicProfileResult.data?.home_court_id) {
          setHomeCourtId(publicProfileResult.data.home_court_id);
        }

        // Fetch partner/opponent stats
        fetchPartnerOpponentStats(user.id);

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

  const handleRefreshStats = async () => {
    if (!user?.id) return;
    
    setRefreshing(true);
    try {
      const { error: recomputeError } = await supabase.rpc('recalculate_all_ratings');

      if (recomputeError) {
        console.error('Recomputation error:', recomputeError);
        toast.error("Failed to recalculate ratings");
        return;
      }

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleClearOne = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleSelectNotification = (id: string) => {
    const notification = notifications.find(n => n.id === id);
    if (notification) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, unread: false } : n)
      );
      setIsDrawerOpen(false);
      navigate(notification.link);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'Pulse Pickleball',
      text: 'Join me on Pulse - Track your pickleball journey and compete with friends!',
      url: 'https://pulsepb.com'
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Thanks for spreading the word!");
      } else {
        await navigator.clipboard.writeText('https://pulsepb.com');
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
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--page-bg))]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const weeklyChange = profile 
    ? profile.current_rating - profile.week_start_rating 
    : 0;

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      {user && (
        <OnboardingTutorial 
          userId={user.id} 
          onComplete={() => console.log('Tutorial completed')}
        />
      )}
      
      {/* Navigation */}
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity logo-pulse" />
          </Link>
          <div className="flex items-center gap-3">
            <UnverifiedMatchesIndicator />
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
            <NotificationBell 
              unreadCount={unreadCount}
              onOpen={() => setIsDrawerOpen(true)}
            />
            <Button variant="secondary" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Dashboard Content */}
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* MFA Prompt */}
        <MFAPrompt />

        {/* 1. Hero Pulse Score Card with Swipeable Stats */}
        <PulseScoreCard 
          currentRating={profile?.current_rating}
          weeklyChange={weeklyChange}
          userId={user?.id}
          wins={profile?.wins}
          losses={profile?.losses}
          totalMatches={profile?.total_matches}
          pointsFor={profile?.total_points_for}
          pointsAgainst={profile?.total_points_against}
          avgOpponentRating={profile?.avg_opponent_rating}
          mostPlayedPartner={mostPlayedPartner}
          mostFacedOpponent={mostFacedOpponent}
        />

        {/* 2. Quick Actions Row */}
        <QuickActionsBar />

        {/* 3. Activity Module (Tabs: Matches | Events) */}
        <ActivityModule userId={user?.id} />

        {/* 4. Stats by Court (Collapsible) */}
        <StatsByCourtCard userId={user?.id} />

        {/* 5. Your Spaces Preview */}
        <SpacesPreviewRow 
          userId={user?.id}
          homeCourtId={homeCourtId}
        />

        {/* Secondary Tools */}
        <div className="space-y-4" data-tour="court-stats">
          <SmartMatch userId={user?.id || null} />
          <LFGNotifications />
        </div>

        {/* 6. Footer Utilities */}
        <HomeFooterUtilities 
          isAdmin={isAdmin}
          onShare={handleShare}
          onRefreshStats={handleRefreshStats}
          refreshing={refreshing}
        />
      </div>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        notifications={notifications}
        onClose={() => setIsDrawerOpen(false)}
        onClearAll={handleClearAll}
        onClearOne={handleClearOne}
        onSelectNotification={handleSelectNotification}
      />

      {/* Special button for alexanderskhoury@gmail.com */}
      {user?.email === "alexanderskhoury@gmail.com" && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Button
            size="lg"
            onClick={() => navigate("/tournaments")}
            className="shadow-lg"
          >
            <Trophy className="w-5 h-5 mr-2" />
            Browse Tournaments
          </Button>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Dashboard;
