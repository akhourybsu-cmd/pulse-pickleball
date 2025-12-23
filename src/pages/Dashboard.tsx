import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Trophy, TrendingUp, Activity } from "lucide-react";
import type { User } from "@supabase/supabase-js";

import { Footer } from "@/components/Footer";
import { OnboardingTutorial } from "@/components/OnboardingTutorial";
import { SmartMatch } from "@/components/court/SmartMatch";
import { LFGNotifications } from "@/components/court/LFGNotifications";
import { NotificationDrawer, Notification } from "@/components/NotificationDrawer";

// Dashboard Components
import { ProfileHero } from "@/components/dashboard/ProfileHero";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { ActivityModule } from "@/components/dashboard/ActivityModule";
import { StatsByCourtCard } from "@/components/dashboard/StatsByCourtCard";
import { SpacesPreviewRow } from "@/components/dashboard/SpacesPreviewRow";
import { HomeFooterUtilities } from "@/components/dashboard/HomeFooterUtilities";
import { VenueActivitySection } from "@/components/dashboard/VenueActivitySection";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  current_rating: number;
  week_start_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
  total_points_for: number;
  total_points_against: number;
  avg_opponent_rating: number;
  state: string | null;
  town: string | null;
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
  const [partnersCount, setPartnersCount] = useState(0);
  const [courtsPlayed, setCourtsPlayed] = useState(0);

  const unreadCount = notifications.filter(n => n.unread).length;

  const fetchPartnerAndCourtStats = async (userId: string) => {
    try {
      const { data: userMatches } = await supabase
        .from("match_participants")
        .select(`match_id, team, matches!inner (id, status)`)
        .eq("player_id", userId)
        .eq("matches.status", "approved");

      if (userMatches?.length) {
        const matchIds = userMatches.map(m => m.match_id);
        const userTeamMap = new Map(userMatches.map(m => [m.match_id, m.team]));

        const { data: allParticipants } = await supabase
          .from("match_participants")
          .select("match_id, player_id, team")
          .in("match_id", matchIds)
          .neq("player_id", userId);

        if (allParticipants) {
          const uniquePartners = new Set<string>();
          allParticipants.forEach(p => {
            if (p.team === userTeamMap.get(p.match_id)) {
              uniquePartners.add(p.player_id);
            }
          });
          setPartnersCount(uniquePartners.size);
        }
      }

      const { data: courtsData } = await supabase
        .from("matches")
        .select("court_id")
        .in("id", userMatches?.map(m => m.match_id) || [])
        .not("court_id", "is", null);

      if (courtsData) {
        const uniqueCourts = new Set(courtsData.map(c => c.court_id).filter(Boolean));
        setCourtsPlayed(uniqueCourts.size);
      }
    } catch (error) {
      console.error("Error fetching partner/court stats:", error);
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

        if (publicProfileResult.data?.home_court_id) {
          setHomeCourtId(publicProfileResult.data.home_court_id);
        }

        fetchPartnerAndCourtStats(user.id);

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const locationStr = [profile?.town, profile?.state].filter(Boolean).join(", ") || null;

  return (
    <div className="min-h-screen bg-background">
      {user && (
        <OnboardingTutorial 
          userId={user.id} 
          onComplete={() => console.log('Tutorial completed')}
        />
      )}
      
      {/* Profile Hero Header */}
      <ProfileHero
        userId={user?.id}
        fullName={profile?.full_name || null}
        displayName={profile?.display_name || null}
        avatarUrl={profile?.avatar_url}
        location={locationStr}
        currentRating={profile?.current_rating}
        totalMatches={profile?.total_matches}
        wins={profile?.wins}
        losses={profile?.losses}
        partnersCount={partnersCount}
        courtsPlayed={courtsPlayed}
        unreadNotifications={unreadCount}
        onNotificationOpen={() => setIsDrawerOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Main Dashboard Content - Centered container with max-width */}
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-6 lg:py-8 space-y-6 lg:space-y-8">

        {/* Desktop: Two-column split (Performance 8-col + Activity 4-col) */}
        {/* Mobile: Tabbed interface */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
          {/* Left Column - Performance + Settings + Spaces */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
              <h2 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Performance
              </h2>
              
              {/* Quick Actions 2x2 Grid */}
              <QuickActionsBar />
            </div>
            
            {/* Settings - Compact utility card under Quick Actions */}
            <HomeFooterUtilities 
              isAdmin={isAdmin}
              onShare={async () => {
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
              }}
              onRefreshStats={handleRefreshStats}
              refreshing={refreshing}
            />
            
            {/* Your Spaces */}
            <SpacesPreviewRow 
              userId={user?.id}
              homeCourtId={homeCourtId}
            />
            
            {/* Venue Activity Section */}
            <VenueActivitySection />
            
            {/* Most Played Court */}
            <StatsByCourtCard userId={user?.id} />
            
            {/* Secondary Tools */}
            <div className="space-y-4" data-tour="court-stats">
              <SmartMatch userId={user?.id || null} />
              <LFGNotifications />
            </div>
          </div>
          
          {/* Right Column - Activity (fixed height scrollable) */}
          <div className="lg:col-span-5">
            <div className="bg-card rounded-xl border border-border shadow-sm sticky top-6">
              <div className="p-5 pb-3 border-b border-border">
                <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Activity
                </h2>
              </div>
              <div className="max-h-[calc(100vh-200px)] overflow-y-auto p-5 pt-3">
                <ActivityModule userId={user?.id} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Tabbed Interface */}
        <div className="lg:hidden">
          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-1 rounded-full">
              <TabsTrigger 
                value="performance" 
                className="text-sm rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="text-sm rounded-full data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Activity className="w-4 h-4 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="mt-0 space-y-4">
              {/* Quick Actions 2x2 Grid */}
              <QuickActionsBar />

              {/* Most Played Court Chip */}
              <StatsByCourtCard userId={user?.id} />

              {/* Your Spaces - Swipeable Cards */}
              <SpacesPreviewRow 
                userId={user?.id}
                homeCourtId={homeCourtId}
              />

              {/* Secondary Tools */}
              <div className="space-y-4" data-tour="court-stats">
                <SmartMatch userId={user?.id || null} />
                <LFGNotifications />
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0 space-y-4">
              <ActivityModule userId={user?.id} />
            </TabsContent>
          </Tabs>

          {/* Footer Utilities - Mobile */}
          <div className="mt-6">
            <HomeFooterUtilities 
              isAdmin={isAdmin}
              onShare={async () => {
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
              }}
              onRefreshStats={handleRefreshStats}
              refreshing={refreshing}
            />
          </div>
        </div>
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
