import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";

import { Footer } from "@/components/Footer";
import { OnboardingWelcome } from "@/components/onboarding";
import { SectionHeader } from "@/components/layout/SectionHeader";

// Dashboard Components — Phase 2 overhaul slim list.
// Dropped from Home (these surfaces don't belong on the player-first hub):
//   • VenueActivitySection  — venue-flavored; lives on the venue side
//   • HomeFooterUtilities   — admin/share/refresh; moves to Profile in Phase 5
//   • ExploreCard           — already removed in the player-first refocus
import { ProfileHero } from "@/components/dashboard/ProfileHero";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { GettingStartedCard } from "@/components/dashboard/GettingStartedCard";
import { ActivityModule } from "@/components/dashboard/ActivityModule";
import { PerformanceModule } from "@/components/dashboard/PerformanceModule";
// StatsByCourtCard removed from home — court-as-tracked-entity is being retired.
import { UpcomingEventsPreview } from "@/components/dashboard/UpcomingEventsPreview";
import { MyRoundRobinsCard } from "@/components/dashboard/MyRoundRobinsCard";
import { MyLeaguesSection } from "@/components/dashboard/MyLeaguesSection";
import { UpNextLeagueMatchesSection } from "@/components/dashboard/UpNextLeagueMatchesSection";
import { MyCommunitiesRail } from "@/components/dashboard/MyCommunitiesRail";
import { MyFriendsRail } from "@/components/dashboard/MyFriendsRail";
import { EnablePushBanner } from "@/components/dashboard/EnablePushBanner";
import { ConfirmNameDialog } from "@/components/profile/ConfirmNameDialog";
// RoleSwitcherCard hidden during the player-only beta. Re-import + render
// when the venue surface returns.
// import { RoleSwitcherCard } from "@/components/dashboard/RoleSwitcherCard";

const NAME_CONFIRM_DISMISS_KEY = "pulse:name-confirm-dismissed";

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  name_locked: boolean;
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
  const { user, profile: sharedProfile, loading } = useAuthState();
  const [profileOverrides, setProfileOverrides] = useState<Partial<Profile>>({});
  const profile = useMemo(
    () => sharedProfile ? ({ ...sharedProfile, ...profileOverrides } as Profile) : null,
    [sharedProfile, profileOverrides],
  );
  const navigate = useNavigate();

  // Onboarding welcome modal
  const [showOnboardingWelcome, setShowOnboardingWelcome] = useState(false);

  // One-time "confirm your name" prompt for existing (pre-lock) users.
  const [showConfirmName, setShowConfirmName] = useState(false);

  useEffect(() => {
    if (!profile) return;

    // The shared auth provider already owns the profile request. This effect
    // only derives dashboard presentation state from that cached profile.
    const showWelcome = !profile.tutorial_completed && (profile.total_matches || 0) === 0;
    setShowOnboardingWelcome(showWelcome);

    const dismissedThisSession = sessionStorage.getItem(NAME_CONFIRM_DISMISS_KEY) === "1";
    setShowConfirmName(!showWelcome && !profile.name_locked && !dismissedThisSession);
  }, [profile]);

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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_18%_0%,hsl(var(--primary)/0.07),transparent_44%)]"
      />
      {user && (
        <OnboardingWelcome
          isOpen={showOnboardingWelcome}
          onStart={() => {
            setShowOnboardingWelcome(false);
            navigate('/onboarding/profile');
          }}
          onSkip={async () => {
            setShowOnboardingWelcome(false);
            await supabase.from('profiles').update({ tutorial_completed: true }).eq('id', user.id);
            setProfileOverrides((current) => ({ ...current, tutorial_completed: true }));
          }}
          hasCompletedProfile={!!(profile?.display_name || profile?.full_name)}
        />
      )}

      {user && profile && (
        <ConfirmNameDialog
          open={showConfirmName}
          userId={user.id}
          initialFirstName={profile.first_name}
          initialLastName={profile.last_name}
          onConfirmed={() => {
            setShowConfirmName(false);
            setProfileOverrides((current) => ({ ...current, name_locked: true }));
          }}
          onDismiss={() => {
            setShowConfirmName(false);
            sessionStorage.setItem(NAME_CONFIRM_DISMISS_KEY, "1");
          }}
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
      <div className="relative mx-auto w-full max-w-[1400px] px-4 pb-10 pt-4 lg:px-8 lg:pb-14 lg:pt-5">

        {/* Getting started — durable first-run orientation (shown until the
            steps are done or dismissed). Above the layout split so it leads on
            both mobile and desktop. Renders null (no phantom spacing) when done. */}
        <GettingStartedCard userId={user?.id} profile={profile} />

        {/* Desktop: Two-column — action stack left, sticky activity right */}
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-9">
          <div className="space-y-9 xl:space-y-10">
            <EnablePushBanner />
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
                    className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    View all →
                  </Link>
                }
              />
              <MyRoundRobinsCard userId={user?.id} />
            </div>

            {/* My leagues — Phase 1 player-facing surface. Self-hides
                when the user has no active memberships so we don't
                advertise emptiness. Invite-based today. */}
            <MyLeaguesSection />
            <UpNextLeagueMatchesSection />

            {/* Social surfaces share a balanced desktop row instead of creating
                two full-width rails with large pockets of unused space. */}
            <div className="grid grid-cols-2 gap-4">
              <div
                className="min-w-0 rounded-[22px] border border-border/60 bg-card/80 p-4 opacity-0 shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.5)] animate-fade-up"
                style={{ animationDelay: '180ms', animationFillMode: 'forwards' }}
              >
                <SectionHeader
                  label="My communities"
                  action={
                    <Link to="/player/community" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      See all →
                    </Link>
                  }
                />
                <MyCommunitiesRail />
              </div>

              <div
                className="min-w-0 rounded-[22px] border border-border/60 bg-card/80 p-4 opacity-0 shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.5)] animate-fade-up"
                style={{ animationDelay: '190ms', animationFillMode: 'forwards' }}
              >
                <SectionHeader
                  label="My friends"
                  action={
                    <Link to="/player/friends" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      View all →
                    </Link>
                  }
                />
                <MyFriendsRail />
              </div>
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
                    className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    All matches →
                  </Link>
                }
              />
              <PerformanceModule userId={user?.id} />
              {/* StatsByCourtCard removed — see import comment */}
            </div>
            {/* "Discover play" (SmartMatch + LFGNotifications) removed — it was
                the court/LFG surface, retired with the court board. The header
                rendered over nothing for players with no LFG data, and its
                cards linked to the now-removed /court/board. */}
          </div>

          {/* Right column stays glanceable and gives upcoming play a natural home. */}
          <aside>
            <div
              className="sticky top-[92px] space-y-7 opacity-0 animate-fade-up"
              style={{ animationDelay: '150ms', animationFillMode: 'forwards' }}
            >
              <div>
                <SectionHeader label="Needs attention" />
                <div className="overflow-hidden rounded-[22px] border border-border/60 bg-card shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.55)]">
                  <div className="max-h-[min(46vh,480px)] overflow-y-auto p-[18px]">
                    <ActivityModule userId={user?.id} />
                  </div>
                </div>
              </div>
              <div>
                <SectionHeader
                  label="Up next"
                  action={
                    <Link to="/player/play" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      Find more →
                    </Link>
                  }
                />
                <div className="shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.55)]">
                  <UpcomingEventsPreview userId={user?.id} />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* Mobile: single linear flow. Activity at top (action items first),
            then the player-first stack. Quick Actions already render inside
            ProfileHero above on mobile. */}
        <div className="mt-5 space-y-8 lg:hidden">
          <EnablePushBanner />
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader label="Needs attention" />
            <div className="rounded-[20px] border border-border/60 bg-card p-4 shadow-[0_12px_30px_-28px_hsl(var(--foreground)/0.5)]">
              <ActivityModule userId={user?.id} />
            </div>
          </div>

          {/* My round robins — see desktop comment above for rationale. */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '160ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="My round robins"
              action={
                <Link to="/player/round-robins" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  View all →
                </Link>
              }
            />
            <MyRoundRobinsCard userId={user?.id} />
          </div>

          {/* My leagues — Phase 1 player-facing surface. Same
              self-hide-when-empty behavior as the desktop grid. */}
          <MyLeaguesSection />
          <UpNextLeagueMatchesSection />

          {/* My communities — quick-tap rail */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '180ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="My communities"
              action={
                <Link to="/player/community" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  See all →
                </Link>
              }
            />
            <MyCommunitiesRail />
          </div>

          {/* My friends — see desktop comment above for rationale. */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '190ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="My friends"
              action={
                <Link to="/player/friends" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  View all →
                </Link>
              }
            />
            <MyFriendsRail />
          </div>

          {/* Up next */}
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              label="Up next"
              action={
                <Link to="/player/play" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
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
                <Link to="/player/matches" className="inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  All matches →
                </Link>
              }
            />
            <PerformanceModule userId={user?.id} />
            {/* StatsByCourtCard removed — see import comment */}
          </div>
          {/* "Discover play" (SmartMatch + LFGNotifications) removed — retired
              court/LFG surface; see the desktop column note above. */}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Dashboard;
