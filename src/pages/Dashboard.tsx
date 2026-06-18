import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";

import { Footer } from "@/components/Footer";
import { OnboardingWelcome } from "@/components/onboarding";
import { SmartMatch } from "@/components/court/SmartMatch";
import { LFGNotifications } from "@/components/court/LFGNotifications";
import { SectionHeader } from "@/components/layout/SectionHeader";

// Dashboard Components — Phase 2 overhaul slim list.
// Dropped from Home (these surfaces don't belong on the player-first hub):
//   • VenueActivitySection  — venue-flavored; lives on the venue side
//   • HomeFooterUtilities   — admin/share/refresh; moves to Profile in Phase 5
//   • ExploreCard           — already removed in the player-first refocus
import { ProfileHero } from "@/components/dashboard/ProfileHero";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { ActivityModule } from "@/components/dashboard/ActivityModule";
import { PerformanceModule } from "@/components/dashboard/PerformanceModule";
import { StatsByCourtCard } from "@/components/dashboard/StatsByCourtCard";
import { UpcomingEventsPreview } from "@/components/dashboard/UpcomingEventsPreview";
import { MyRoundRobinsCard } from "@/components/dashboard/MyRoundRobinsCard";
import { MyCommunitiesRail } from "@/components/dashboard/MyCommunitiesRail";
import { EnablePushBanner } from "@/components/dashboard/EnablePushBanner";
// RoleSwitcherCard hidden during the player-only beta. Re-import + render
// when the venue surface returns.
// import { RoleSwitcherCard } from "@/components/dashboard/RoleSwitcherCard";

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
  const navigate = useNavigate();

  // Partner/Opponent stats (currently fetched but unused after Phase 2 reshuffle;
  // PerformanceModule shows the rich detail. Kept for future use.)
  const [, setPartnersCount] = useState(0);
  const [, setCourtsPlayed] = useState(0);

  // Onboarding welcome modal
  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState(false);

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

        const [profileResult, publicProfileResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("profiles_public").select("home_court_id").eq("id", user.id).single()
        ]);

        if (profileResult.error) {
          console.error("Profile fetch error:", profileResult.error);
          toast.error("Failed to load profile");
          setLoading(false);
          return;
        }

        setProfile(profileResult.data);

        // Show onboarding welcome for new users
        if (!profileResult.data.tutorial_completed && (profileResult.data.total_matches || 0) === 0) {
          setShowOnboardingWelcome(true);
        }

        // home_court_id fetched but unused after Phase 2 reshuffle; query
        // stays so the prefetched join doesn't change.
        void publicProfileResult.data?.home_court_id;

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

  // handleRefreshStats + handleShare moved to Profile (Phase 5) — they belonged
  // in HomeFooterUtilities which is no longer rendered on Home.

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
        <OnboardingWelcome 
          isOpen={showOnboardingWelcome}
          onClose={() => setShowOnboardingWelcome(false)}
          onStart={() => {
            setShowOnboardingWelcome(false);
            navigate('/onboarding/profile');
          }}
          onSkip={async () => {
            setShowOnboardingWelcome(false);
            await supabase.from('profiles').update({ tutorial_completed: true }).eq('id', user.id);
          }}
          hasCompletedProfile={!!(profile?.display_name || profile?.full_name)}
          hasFirstMatch={(profile?.total_matches || 0) > 0}
        />
      )}
      
      {/* Player Identity hero — the actual page hero now that PlayerShell
          owns the top nav. Staggered fade-up animations live inside the card. */}
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
      />

      {/* Main Dashboard Content — single linear flow on mobile, two-column
          on desktop. The previous Performance/Activity tab toggle on mobile
          was removed in favor of always showing Activity at the top (when
          there's action to take) followed by the player-first stack. */}
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-4 lg:py-6">

        {/* Desktop: Two-column — action stack left, sticky activity right */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-7 space-y-8">
            {/* Quick Actions — primary action surface (Record Match etc.) */}
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader label="Quick actions" />
              <QuickActionsBar />
            </div>

            {/* My round robins — active + upcoming RRs where you're hosting
                or playing. Replaces the dropped "Round Robins" QuickAction
                tile AND the global RoundRobinBanner that used to flash above
                PlayerShell. The card surfaces the actual events with
                tappable rows that go straight to the event detail. */}
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader
                label="My round robins"
                action={
                  <Link
                    to="/player/round-robins"
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    View all →
                  </Link>
                }
              />
              <MyRoundRobinsCard userId={user?.id} />
            </div>
            {/* My communities — quick-tap rail to any group the user is in */}
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: '180ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader
                label="My communities"
                action={
                  <Link
                    to="/player/community"
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    See all →
                  </Link>
                }
              />
              <MyCommunitiesRail />
            </div>

            {/* Up next — upcoming registered play */}
            <div
              className="opacity-0 animate-fade-up"
              style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader
                label="Up next"
                action={
                  <Link
                    to="/player/play"
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    Find more →
                  </Link>
                }
              />
              <UpcomingEventsPreview userId={user?.id} />
            </div>

            {/* Recent form — match history + court stats */}
            <div
              className="opacity-0 animate-fade-up space-y-4"
              style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader
                label="Recent form"
                action={
                  <Link
                    to="/player/matches"
                    className="text-muted-foreground hover:text-foreground transition-colors font-medium"
                  >
                    All matches →
                  </Link>
                }
              />
              <PerformanceModule userId={user?.id} />
              <StatsByCourtCard userId={user?.id} />
            </div>

            {/* Discover play — player-to-player LFG features */}
            <div
              className="opacity-0 animate-fade-up space-y-3"
              style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
              data-tour="court-stats"
            >
              <SectionHeader label="Discover play" />
              <SmartMatch userId={user?.id || null} />
              <LFGNotifications />
            </div>
          </div>

          {/* Right Column — Activity (action items, sticky) */}
          <aside className="lg:col-span-5">
            <div
              className="sticky top-6 opacity-0 animate-fade-up"
              style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
            >
              <SectionHeader label="Needs attention" />
              <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="max-h-[calc(100vh-180px)] overflow-y-auto p-4">
                  <ActivityModule userId={user?.id} />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile: single linear flow. Activity at top (action items first),
            then the player-first stack. Quick Actions already render inside
            ProfileHero above on mobile. */}
        <div className="lg:hidden space-y-7 mt-4">
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader label="Needs attention" />
            <ActivityModule userId={user?.id} />
          </div>

          {/* My round robins — see desktop comment above for rationale. */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="My round robins"
              action={
                <Link to="/player/round-robins" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                  View all →
                </Link>
              }
            />
            <MyRoundRobinsCard userId={user?.id} />
          </div>

          {/* My communities — quick-tap rail */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '180ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="My communities"
              action={
                <Link to="/player/community" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                  See all →
                </Link>
              }
            />
            <MyCommunitiesRail />
          </div>

          {/* Up next */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="Up next"
              action={
                <Link to="/player/play" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                  Find more →
                </Link>
              }
            />
            <UpcomingEventsPreview userId={user?.id} />
          </div>

          {/* Recent form */}
          <div
            className="opacity-0 animate-fade-up space-y-4"
            style={{ animationDelay: '240ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="Recent form"
              action={
                <Link to="/player/matches" className="text-muted-foreground hover:text-foreground transition-colors font-medium">
                  All matches →
                </Link>
              }
            />
            <PerformanceModule userId={user?.id} />
            <StatsByCourtCard userId={user?.id} />
          </div>

          {/* Discover play */}
          <div
            className="opacity-0 animate-fade-up space-y-3"
            style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
            data-tour="court-stats"
          >
            <SectionHeader label="Discover play" />
            <SmartMatch userId={user?.id || null} />
            <LFGNotifications />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
