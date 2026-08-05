import React, { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ActiveViewProvider } from "@/contexts/ActiveViewContext";

import { useAuthPersistence } from "@/hooks/useAuthPersistence";
import { setPushNavigator } from "@/lib/push";
import { PlayerShell } from "@/components/layout/PlayerShell";
import { CommunityTransitionOutlet } from "@/components/community/CommunityTransitionOutlet";
import { LeagueTransitionOutlet } from "@/components/leagues/LeagueTransitionOutlet";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";
import { AuthGuard, AdminGuard } from "@/components/guards";
import { supabase } from "@/integrations/supabase/client";
// RoundRobinBanner was a global "Round Robin Match In Progress" strip
// shown above PlayerShell whenever a participant had a live event.
// Replaced by MyRoundRobinsCard on the dashboard so live events surface
// in context (alongside the host's own events) instead of as a
// dismissible toast above every screen. The component file is kept on
// disk in case we want to revive a global indicator later.
// import { RoundRobinBanner } from "@/components/RoundRobinBanner";
import { ScrollManager } from "@/components/ScrollManager";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { clearPostAuthRedirect, consumePostAuthRedirect, isAuthEntryPath } from "@/lib/authRedirect";

/**
 * Forward the current location's `search` (and `hash`) when redirecting from a
 * legacy alias to its new home. Plain <Navigate to="..."/> drops query params,
 * which silently breaks deep links like /player/find?type=tournament.
 */
function RedirectWithParams({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

/**
 * Redirect the retired /admin/leagues/:leagueId[/poster] routes into the
 * single public league portal under /player/leagues. Interpolates the
 * :leagueId param (RedirectWithParams only handles static targets) and
 * preserves any query/hash.
 */
function LeagueAdminRedirect({ suffix = "/manage" }: { suffix?: string }) {
  const { leagueId } = useParams();
  const location = useLocation();
  const base = leagueId
    ? `/player/leagues/${leagueId}${suffix}`
    : "/player/leagues";
  return <Navigate to={`${base}${location.search}${location.hash}`} replace />;
}

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-background">
    <div className="space-y-4 w-full max-w-md p-8">
      <Skeleton className="h-8 w-3/4 mx-auto" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

// Lazy load all page components
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const ClaimGuest = lazy(() => import("./pages/ClaimGuest"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const ViewProfile = lazy(() => import("./pages/ViewProfile"));
const MyGuests = lazy(() => import("./pages/player/MyGuests"));
const NewMatch = lazy(() => import("./pages/NewMatch"));
const PendingMatches = lazy(() => import("./pages/PendingMatches"));
const MatchHistory = lazy(() => import("./pages/MatchHistory"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SessionQueue = lazy(() => import("./pages/SessionQueue"));
const AdminSession = lazy(() => import("./pages/AdminSession"));
const AdminPairing = lazy(() => import("./pages/AdminPairing"));
const MatchTicket = lazy(() => import("./pages/MatchTicket"));
const QRCheckIn = lazy(() => import("./pages/QRCheckIn"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const AdminManage = lazy(() => import("./pages/AdminManage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminArchive = lazy(() => import("./pages/admin/AdminArchive"));
const AdminPlayers = lazy(() => import("./pages/AdminPlayers"));
const AdminBadges = lazy(() => import("./pages/AdminBadges"));
const AdminMatches = lazy(() => import("./pages/AdminMatches"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing"));
const AdminLeagueDetail = lazy(() => import("./pages/admin/AdminLeagueDetail"));
const LeaguePoster = lazy(() => import("./pages/admin/LeaguePoster"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Events = lazy(() => import("./pages/Events"));
const NewEvent = lazy(() => import("./pages/NewEvent"));
const EventDetail = lazy(() => import("./pages/EventDetail"));
const EventMatchEntry = lazy(() => import("./pages/EventMatchEntry"));
const DemoTour = lazy(() => import("./pages/DemoTour"));
const RoundRobinHub = lazy(() => import("./pages/RoundRobinHub"));
const CreateRoundRobin = lazy(() => import("./pages/CreateRoundRobin"));
const RoundRobinDetail = lazy(() => import("./pages/RoundRobinDetail"));
const RoundRobinKiosk = lazy(() => import("./pages/RoundRobinKiosk"));
const TournamentAdmin = lazy(() => import("./pages/TournamentAdmin"));
const TournamentEventDetail = lazy(() => import("./pages/TournamentEventDetail"));
const TournamentDivisionDetail = lazy(() => import("./pages/TournamentDivisionDetail"));
const TournamentLiveView = lazy(() => import("./pages/TournamentLiveView"));
const TournamentTeamView = lazy(() => import("./pages/TournamentTeamView"));
const Tournaments = lazy(() => import("./pages/Tournaments"));
const BrowseTournaments = lazy(() => import("./pages/BrowseTournaments"));
const ManageTournaments = lazy(() => import("./pages/ManageTournaments"));
const TournamentRegister = lazy(() => import("./pages/TournamentRegister"));
const TournamentLanding = lazy(() => import("./pages/TournamentLanding"));
const TournamentCustomize = lazy(() => import("./pages/TournamentCustomize"));
const TournamentMatchScore = lazy(() => import("./pages/TournamentMatchScore"));
const TournamentNew = lazy(() => import("./pages/TournamentNew"));
const TournamentNewWithGating = lazy(() => import("./pages/TournamentNewWithGating"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const TournamentDivisionDetailNew = lazy(() => import("./pages/TournamentDivisionDetailNew"));
const TournamentPaymentSuccess = lazy(() => import("./pages/TournamentPaymentSuccess"));
const TournamentPaymentCancelled = lazy(() => import("./pages/TournamentPaymentCancelled"));
const TournamentsLanding = lazy(() => import("./pages/TournamentsLanding"));
const DataExport = lazy(() => import("./pages/DataExport"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminTestAccounts = lazy(() => import("./pages/AdminTestAccounts"));
const AdminBiometrics = lazy(() => import("./pages/AdminBiometrics"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const AdminPasswordReset = lazy(() => import("./pages/AdminPasswordReset"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const SecuritySettings = lazy(() => import("./pages/SecuritySettings"));
const BlockedUsers = lazy(() => import("./pages/BlockedUsers"));

// Player pages
const PlayerDashboard = lazy(() => import("./pages/player/PlayerDashboard"));
const SelfAssessment = lazy(() => import("./pages/player/SelfAssessment"));
const PlayerLeagues = lazy(() => import("./pages/player/PlayerLeagues"));
const PlayerLeagueDetail = lazy(() => import("./pages/player/PlayerLeagueDetail"));
const PlayerProfile = lazy(() => import("./pages/player/PlayerProfile"));
const PlayerPulse = lazy(() => import("./pages/player/PlayerPulse"));
const MyRoundRobinsPage = lazy(() => import("./pages/player/MyRoundRobinsPage"));
const PlayHub = lazy(() => import("./pages/play/PlayHub"));

const PlayerEvents = lazy(() => import("./pages/player/PlayerEvents"));
const PlayerCoaching = lazy(() => import("./pages/player/PlayerCoaching"));
const MyEvents = lazy(() => import("./pages/player/MyEvents"));
const FindEvents = lazy(() => import("./pages/player/FindEvents"));
const Community = lazy(() => import("./pages/player/Community"));
const GroupDetail = lazy(() => import("./pages/player/GroupDetail"));
const JoinGroupByCode = lazy(() => import("./pages/player/JoinGroupByCode"));
const JoinLeagueByCode = lazy(() => import("./pages/player/JoinLeagueByCode"));
const GroupManage = lazy(() => import("./pages/player/GroupManage"));
const DirectMessageChat = lazy(() => import("./pages/player/DirectMessageChat"));
const Social = lazy(() => import("./pages/player/Social"));

const PlayersLanding = lazy(() => import("./pages/PlayersLanding"));

// Onboarding pages
const OnboardingProfileSetup = lazy(() => import("./pages/onboarding/ProfileSetup"));
const OnboardingRatingReveal = lazy(() => import("./pages/onboarding/RatingReveal"));
const OnboardingComplete = lazy(() => import("./pages/onboarding/Complete"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const AppContent = () => {
  const navigate = useNavigate();
  const [authRecoveryChecked, setAuthRecoveryChecked] = useState(false);
  useAuthPersistence();

  // Route a tapped native push notification through the router.
  useEffect(() => {
    setPushNavigator((path) => navigate(path));
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    const finish = () => {
      if (!cancelled) setAuthRecoveryChecked(true);
    };

    const recoverOAuthReturn = async () => {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const queryParams = url.searchParams;
      const authType = hashParams.get("type") || queryParams.get("type");

      if (authType === "recovery" || url.pathname === "/reset-password") {
        finish();
        return;
      }

      const errorMessage =
        hashParams.get("error_description") ||
        queryParams.get("error_description") ||
        hashParams.get("error") ||
        queryParams.get("error");
      const accessToken = hashParams.get("access_token") || queryParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token") || queryParams.get("refresh_token");
      const code = queryParams.get("code") || hashParams.get("code");
      const canUseCode = Boolean(
        code &&
        (queryParams.has("state") ||
          isAuthEntryPath(url.pathname) ||
          url.pathname.startsWith("/profile") ||
          url.pathname.startsWith("/player/profile")),
      );

      if (!errorMessage && !accessToken && !refreshToken && !canUseCode) {
        finish();
        return;
      }

      try {
        if (errorMessage) {
          clearPostAuthRedirect();
          toast.error(errorMessage);
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }

        [
          "code",
          "state",
          "type",
          "error",
          "error_code",
          "error_description",
          "access_token",
          "refresh_token",
          "expires_in",
          "expires_at",
          "token_type",
        ].forEach((key) => url.searchParams.delete(key));
        const remainingSearch = url.searchParams.toString();
        window.history.replaceState({}, document.title, `${url.pathname}${remainingSearch ? `?${remainingSearch}` : ""}`);

        if (!errorMessage && isAuthEntryPath(url.pathname)) {
          navigate(consumePostAuthRedirect(), { replace: true });
          return;
        }
      } catch (error) {
        console.error("OAuth return handling failed:", error);
        clearPostAuthRedirect();
        toast.error(error instanceof Error ? error.message : "Sign-in could not be completed");
      } finally {
        finish();
      }
    };

    recoverOAuthReturn();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
        const currentPath = window.location.pathname;
        if (isAuthEntryPath(currentPath)) {
          navigate(consumePostAuthRedirect(), { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  if (!authRecoveryChecked) {
    return <PageLoader />;
  }

  return (
    <>
      <ScrollManager />
      <PWAInstallPrompt />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
         <Route path="/unsubscribe" element={<Unsubscribe />} />
         <Route path="/claim-guest/:token" element={<ClaimGuest />} />
         <Route path="/demo" element={<DemoTour />} />
          <Route path="/players" element={<PlayersLanding />} />
          {/* Public legal + account pages — reachable logged-out for the
              app-store listing links and reviewers. */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
          {/* Unified discovery hub (events). Auth-required because
              every inner CTA (register, favorite, book) is auth-gated — letting
              unauthenticated users in causes a partial render then a forced
              bounce to /auth, which loses context. */}
          <Route
            path="/play"
            element={
              <AuthGuard>
                <PlayHub />
              </AuthGuard>
            }
          />
          {/* Legacy browse routes — redirect into the unified hub.
              Use RedirectWithParams so ?type=... and other query params survive. */}
          <Route path="/events/browse" element={<RedirectWithParams to="/play" />} />
          <Route path="/tournaments/browse" element={<RedirectWithParams to="/play" />} />
          
          {/* Onboarding routes - require auth but allow onboarding state.
              Flow (3 steps): profile → how-it-works → complete. The match step
              was decoupled (recording a match is now a post-onboarding action),
              so the legacy first-match/rating paths redirect into the new flow
              to keep any in-flight links working. */}
          <Route path="/onboarding/profile" element={
            <AuthGuard allowOnboarding><OnboardingProfileSetup /></AuthGuard>
          } />
          <Route path="/onboarding/how-it-works" element={
            <AuthGuard allowOnboarding><OnboardingRatingReveal /></AuthGuard>
          } />
          <Route path="/onboarding/first-match" element={<Navigate to="/onboarding/how-it-works" replace />} />
          <Route path="/onboarding/rating" element={<Navigate to="/onboarding/how-it-works" replace />} />
          <Route path="/onboarding/complete" element={
            <AuthGuard allowOnboarding><OnboardingComplete /></AuthGuard>
          } />
          
          {/* Invite-link landing — intentionally OUTSIDE the /player
              AuthGuard wrapper below. JoinGroupByCode supports both
              anon (shows preview + Sign in / Sign up) and authenticated
              (auto-joins) flows; the find_group_by_invite_code RPC is
              granted to anon. Path is kept identical so existing
              shared invite links keep working. Must be declared
              BEFORE the /player block so it wins the URL match. */}
          <Route path="/player/community/join/:code" element={<JoinGroupByCode />} />

          {/* League invite-link landing — same rationale as the group
              join route above: mounted OUTSIDE the /player AuthGuard so a
              logged-out recipient sees the league teaser (Sign in / Sign
              up) instead of a blank auth wall. find_league_by_invite_code
              is granted to anon; joining still requires an account.
              Declared BEFORE the /player block so it wins the URL match. */}
          <Route path="/player/leagues/join/:code" element={<JoinLeagueByCode />} />

          {/* Player routes with shell - require auth */}
          <Route path="/player" element={
            <AuthGuard>
              <PlayerShell />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/player/dashboard" replace />} />
            <Route path="dashboard" element={<PlayerDashboard />} />
            {/* New primary nav routes (Phase 1) */}
            <Route path="matches" element={<MatchHistory />} />
            <Route path="matches/new" element={<NewMatch />} />
            <Route path="matches/pending" element={<Navigate to="/player/matches?tab=pending" replace />} />
            <Route path="play" element={<PlayHub />} />
            <Route path="profile" element={<PlayerProfile />} />
            {/* Player Pulse — interactive rating analytics. Opened by tapping
                the PULSE rating pill on the dashboard/profile identity card. */}
            <Route path="pulse" element={<PlayerPulse />} />
            {/* PULSE Skill Assessment — dedicated route, feature-flagged
                (VITE_SKILL_ASSESSMENT). Distinct from the match-based rating. */}
            {isSkillAssessmentEnabled() && (
              <Route path="self-assessment" element={<SelfAssessment />} />
            )}
            {/* My Round Robins history — replaces the catch-all /round-robin
                hub link that used to live on the dashboard. Past + active
                events in one place. */}
            <Route path="round-robins" element={<MyRoundRobinsPage />} />
            {/* Phase 1 player-facing leagues: read-only "my leagues"
                view. Deeper features (match schedule, standings) land
                as later phases. RLS keeps admin_only leagues invisible. */}
            {/* League routes share a directional slide transition (deeper
                slides in from the right, back slides in from the left),
                mirroring the Community outlet. The pathless parent keeps
                PlayerShell above the transition so the header + bottom nav
                don't remount, and react-router still owns navigation. */}
            <Route element={<LeagueTransitionOutlet />}>
              <Route path="leagues" element={<PlayerLeagues />} />
              <Route path="leagues/:leagueId" element={<PlayerLeagueDetail />} />
              {/* League owner surface — same component as /admin/leagues/:id
                  but rendered inside PlayerShell chrome via URL detection.
                  NOTE: the /poster variant is mounted OUTSIDE PlayerShell
                  (see top-level route below) so print stylesheets don't
                  capture the sticky header + bottom nav. */}
              <Route path="leagues/:leagueId/manage" element={<AdminLeagueDetail />} />
            </Route>
            <Route path="guests" element={<MyGuests />} />
            {/* Legacy aliases - kept functional, redirected from old paths */}
            <Route path="find" element={<RedirectWithParams to="/player/play" />} />
            <Route path="events" element={<PlayerEvents />} />
            {/* Retired venue-era paths — kept as redirects so legacy deep
                links land safely instead of 404-ing. */}
            <Route path="venues" element={<Navigate to="/player/play" replace />} />
            <Route path="coaching" element={<Navigate to="/player/dashboard" replace />} />
            <Route path="bookings" element={<Navigate to="/player/dashboard" replace />} />
            <Route path="my-bookings" element={<Navigate to="/player/dashboard" replace />} />
            <Route path="my-events" element={<MyEvents />} />
            {/* Friends now lives inside the unified Social hub; the path is
                kept so existing links (incl. ?tab=requests) still resolve. */}
            <Route path="social" element={<Social />} />
            <Route path="friends" element={<Social />} />
            {/* community/join/:code is mounted as a top-level route below
                (outside this AuthGuard wrapper) so anon users can land
                on the preview before signing in. The
                find_group_by_invite_code RPC is granted to anon, and
                JoinGroupByCode already has a `need_auth` phase that
                shows Sign in / Sign up CTAs and stashes the redirect.
                Pre-fix the auth gate fired before the preview could
                render, defeating the purpose of an invite link. */}
            {/* Community routes share a directional slide transition
                (native-app feel: deeper slides in from the right, back
                slides out to the right). Wrapping them under a
                pathless parent keeps PlayerShell above the transition
                so the header + bottom nav don't remount. */}
            <Route element={<CommunityTransitionOutlet />}>
              <Route path="community" element={<Community />} />
              <Route path="community/group/:groupId" element={<GroupDetail />} />
              <Route path="community/group/:groupId/manage" element={<GroupManage />} />
            </Route>
            <Route path="messages" element={<Social />} />
            <Route path="messages/:conversationId" element={<DirectMessageChat />} />
            <Route path="profile/edit" element={<EditProfile />} />
          </Route>

          {/* Legacy routes - redirect to new structure */}
          <Route path="/dashboard" element={<Navigate to="/player/dashboard" replace />} />

          {/* Existing routes */}
          <Route path="/profile/edit" element={<RedirectWithParams to="/player/profile/edit" />} />
          <Route path="/profile/:userId" element={<ViewProfile />} />
          <Route path="/player/profile/:userId" element={<ViewProfile />} />
          {/* Match routes: legacy /match/* paths now redirect into the player shell */}
          {/* RedirectWithParams preserves ?onboarding=true and the #matchId hash
              that plain <Navigate> would drop. /match/pending keeps <Navigate>
              because its target already carries a query string. */}
          <Route path="/match/new" element={<RedirectWithParams to="/player/matches/new" />} />
          <Route path="/match/pending" element={<Navigate to="/player/matches?tab=pending" replace />} />
          <Route path="/match/history" element={<RedirectWithParams to="/player/matches" />} />          <Route path="/faq" element={<FAQ />} />
          <Route path="/session/queue" element={<SessionQueue />} />
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/archive" element={<AdminGuard><AdminArchive /></AdminGuard>} />
          <Route path="/admin/session" element={<AdminGuard><AdminSession /></AdminGuard>} />
          <Route path="/admin/pairing" element={<AdminGuard><AdminPairing /></AdminGuard>} />
          <Route path="/admin/players" element={<AdminGuard><AdminPlayers /></AdminGuard>} />
          <Route path="/admin/badges" element={<AdminGuard><AdminBadges /></AdminGuard>} />
          <Route path="/admin/matches" element={<AdminGuard><AdminMatches /></AdminGuard>} />
          {/* Leagues are now ONE public portal under /player/leagues —
              no separate admin surface. These legacy /admin/leagues*
              paths redirect there so old links/bookmarks keep working.
              RLS still enforces that only owners/admins can manage. */}
          <Route path="/admin/leagues" element={<Navigate to="/player/leagues" replace />} />
          <Route path="/admin/leagues/:leagueId" element={<LeagueAdminRedirect suffix="/manage" />} />
          <Route path="/admin/leagues/:leagueId/poster" element={<LeagueAdminRedirect suffix="/poster" />} />
          {/* Player-context poster route — mounted OUTSIDE PlayerShell so
              the sticky header + bottom nav don't overlap the poster on
              screen or bleed into the printed sheet. */}
          <Route path="/player/leagues/:leagueId/poster" element={<AuthGuard><LeaguePoster /></AuthGuard>} />
          <Route path="/admin/marketing" element={<AdminGuard><AdminMarketing /></AdminGuard>} />
          <Route path="/admin/audit-log" element={<AdminGuard><AdminAuditLog /></AdminGuard>} />
          <Route path="/admin/test-accounts" element={<AdminGuard><AdminTestAccounts /></AdminGuard>} />
          <Route path="/admin/biometrics" element={<AdminGuard><AdminBiometrics /></AdminGuard>} />
          <Route path="/admin/system-health" element={<AdminGuard><AdminSystemHealth /></AdminGuard>} />
          <Route path="/admin/password-reset" element={<AdminGuard><AdminPasswordReset /></AdminGuard>} />
          <Route path="/admin/manage/:sessionId" element={<AdminGuard><AdminManage /></AdminGuard>} />
          <Route path="/match/ticket/:ticketId" element={<MatchTicket />} />
          <Route path="/qr-checkin" element={<QRCheckIn />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/changelog" element={<Changelog />} />          {/* NOTE: /events/browse is intentionally redirected to /play above
              (the unified hub). The former <BrowseEvents /> route here was dead
              (shadowed by that earlier redirect) and has been removed. */}          <Route path="/profile/data-export" element={<DataExport />} />
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          <Route path="/settings/security" element={<AuthGuard><SecuritySettings /></AuthGuard>} />
          <Route path="/settings/blocked" element={<BlockedUsers />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<NewEvent />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/events/:eventId/add-match" element={<EventMatchEntry />} />
          <Route path="/round-robin" element={<RoundRobinHub />} />
          {/* Wizard writes to the DB on submit and reads getUser() on submit.
              Wrap in AuthGuard so unauthenticated visitors are bounced before
              filling out the multi-step form (avoids losing their work). */}
          <Route
            path="/round-robin/create"
            element={
              <AuthGuard>
                <CreateRoundRobin />
              </AuthGuard>
            }
          />
          <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
          <Route path="/round-robin/:id/kiosk" element={<RoundRobinKiosk />} />
          {/* Tournament surface archived — admin-only */}
          <Route path="/tournaments" element={<AdminGuard><TournamentsLanding /></AdminGuard>} />
          <Route path="/tournaments/manage" element={<AdminGuard><ManageTournaments /></AdminGuard>} />
          <Route path="/tournaments/new" element={<AdminGuard><TournamentNewWithGating /></AdminGuard>} />
          <Route path="/tournaments/:id" element={<AdminGuard><TournamentDetail /></AdminGuard>} />
          <Route path="/tournaments/:id/divisions/:divisionId" element={<AdminGuard><TournamentDivisionDetailNew /></AdminGuard>} />
          <Route path="/tournaments/:id/customize" element={<AdminGuard><TournamentCustomize /></AdminGuard>} />
          <Route path="/tournaments/:id/payment-success" element={<AdminGuard><TournamentPaymentSuccess /></AdminGuard>} />
          <Route path="/tournaments/:id/payment-cancelled" element={<AdminGuard><TournamentPaymentCancelled /></AdminGuard>} />
          <Route path="/tournament/:slug" element={<AdminGuard><TournamentLanding /></AdminGuard>} />
          <Route path="/tournament/:eventId/register" element={<AdminGuard><TournamentRegister /></AdminGuard>} />          <Route path="/tournament/:eventId/live" element={<AdminGuard><TournamentLiveView /></AdminGuard>} />
          <Route path="/tournament/:eventId/team/:teamId" element={<AdminGuard><TournamentTeamView /></AdminGuard>} />
          <Route path="/tournament/:eventId/match/:matchId/score" element={<AdminGuard><TournamentMatchScore /></AdminGuard>} />
          {/* Platform tournament admin — gated at the router level (security fix Phase 5) */}
          <Route path="/tournament-admin" element={<AdminGuard><TournamentAdmin /></AdminGuard>} />
          <Route path="/tournament-admin/:eventId/customize" element={<AdminGuard><TournamentCustomize /></AdminGuard>} />
          <Route path="/tournament-admin/event/:eventId" element={<AdminGuard><TournamentEventDetail /></AdminGuard>} />
          <Route path="/tournament-admin/event/:eventId/division/:divisionId" element={<AdminGuard><TournamentDivisionDetail /></AdminGuard>} />
          <Route path="/tournament-admin/division/:divisionId" element={<AdminGuard><TournamentDivisionDetail /></AdminGuard>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ActiveViewProvider>
              <AppContent />
            </ActiveViewProvider>
          </BrowserRouter>

        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
