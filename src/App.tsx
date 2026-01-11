import React, { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ModeProvider } from "@/contexts/ModeContext";
import { useAuthPersistence } from "@/hooks/useAuthPersistence";
import { PlayerShell } from "@/components/layout/PlayerShell";
import { AuthGuard, VenueGuard } from "@/components/guards";
import { VenueShell } from "@/components/layout/VenueShell";
import { RoundRobinBanner } from "@/components/RoundRobinBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

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
const Dashboard = lazy(() => import("./pages/Dashboard"));
const EditProfile = lazy(() => import("./pages/EditProfile"));
const ViewProfile = lazy(() => import("./pages/ViewProfile"));
const NewMatch = lazy(() => import("./pages/NewMatch"));
const PendingMatches = lazy(() => import("./pages/PendingMatches"));
const MatchHistory = lazy(() => import("./pages/MatchHistory"));
const CourtHistory = lazy(() => import("./pages/CourtHistory"));
const CourtBoard = lazy(() => import("./pages/CourtBoard"));
const CourtConnector = lazy(() => import("./pages/CourtConnector"));
const CourtSettings = lazy(() => import("./pages/CourtSettings"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const FAQ = lazy(() => import("./pages/FAQ"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SessionQueue = lazy(() => import("./pages/SessionQueue"));
const AdminSession = lazy(() => import("./pages/AdminSession"));
const AdminPairing = lazy(() => import("./pages/AdminPairing"));
const MatchTicket = lazy(() => import("./pages/MatchTicket"));
const QRCheckIn = lazy(() => import("./pages/QRCheckIn"));
const Kiosk = lazy(() => import("./pages/Kiosk"));
const AdminManage = lazy(() => import("./pages/AdminManage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminPlayers = lazy(() => import("./pages/AdminPlayers"));
const AdminBadges = lazy(() => import("./pages/AdminBadges"));
const AdminMatches = lazy(() => import("./pages/AdminMatches"));
const AdminMarketing = lazy(() => import("./pages/AdminMarketing"));
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
const TournamentRegister = lazy(() => import("./pages/TournamentRegister"));
const TournamentLanding = lazy(() => import("./pages/TournamentLanding"));
const TournamentCustomize = lazy(() => import("./pages/TournamentCustomize"));
const TournamentNew = lazy(() => import("./pages/TournamentNew"));
const TournamentNewWithGating = lazy(() => import("./pages/TournamentNewWithGating"));
const TournamentDetail = lazy(() => import("./pages/TournamentDetail"));
const TournamentDivisionDetailNew = lazy(() => import("./pages/TournamentDivisionDetailNew"));
const TournamentPaymentSuccess = lazy(() => import("./pages/TournamentPaymentSuccess"));
const TournamentPaymentCancelled = lazy(() => import("./pages/TournamentPaymentCancelled"));
const TournamentsLanding = lazy(() => import("./pages/TournamentsLanding"));
const CreateVenueFast = lazy(() => import("./pages/venue/CreateVenueFast"));
const Reservations = lazy(() => import("./pages/Reservations"));
const MyCalendarRegistrations = lazy(() => import("./pages/MyCalendarRegistrations"));
const BrowseEvents = lazy(() => import("./pages/BrowseEvents"));
const PickleballCitiMemberships = lazy(() => import("./pages/PickleballCitiMemberships"));
const DataExport = lazy(() => import("./pages/DataExport"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));
const AdminTestAccounts = lazy(() => import("./pages/AdminTestAccounts"));
const AdminBiometrics = lazy(() => import("./pages/AdminBiometrics"));
const AdminSystemHealth = lazy(() => import("./pages/AdminSystemHealth"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));

// Player pages
const PlayerDashboard = lazy(() => import("./pages/player/PlayerDashboard"));
const PlayerCourts = lazy(() => import("./pages/player/PlayerCourts"));
const PlayerEvents = lazy(() => import("./pages/player/PlayerEvents"));
const PlayerCoaching = lazy(() => import("./pages/player/PlayerCoaching"));
const PlayerBookings = lazy(() => import("./pages/player/PlayerBookings"));
const VenueDiscovery = lazy(() => import("./pages/player/VenueDiscovery"));
const MyBookings = lazy(() => import("./pages/player/MyBookings"));
const MyEvents = lazy(() => import("./pages/player/MyEvents"));
const FindEvents = lazy(() => import("./pages/player/FindEvents"));
const Community = lazy(() => import("./pages/player/Community"));
const GroupDetail = lazy(() => import("./pages/player/GroupDetail"));
const GroupManage = lazy(() => import("./pages/player/GroupManage"));

// Venue pages
const VenueOverview = lazy(() => import("./pages/venue/VenueOverview"));
const VenueOnboarding = lazy(() => import("./pages/venue/VenueOnboarding"));
const VenueProfile = lazy(() => import("./pages/venue/VenueProfile"));
const VenueBranding = lazy(() => import("./pages/venue/VenueBranding"));
const VenueFacility = lazy(() => import("./pages/venue/VenueFacility"));
const VenueMedia = lazy(() => import("./pages/venue/VenueMedia"));
const VenueCommunity = lazy(() => import("./pages/venue/VenueCommunity"));
const VenueCourts = lazy(() => import("./pages/venue/VenueCourts"));
const VenueBookings = lazy(() => import("./pages/venue/VenueBookings"));
const VenueEvents = lazy(() => import("./pages/venue/VenueEvents"));
const VenueTournaments = lazy(() => import("./pages/venue/VenueTournaments"));
const VenueCoaching = lazy(() => import("./pages/venue/VenueCoaching"));
const VenueStaff = lazy(() => import("./pages/venue/VenueStaff"));
const VenueSettings = lazy(() => import("./pages/venue/VenueSettings"));
const VenueAnalytics = lazy(() => import("./pages/venue/VenueAnalytics"));
const VenueRoundRobins = lazy(() => import("./pages/venue/VenueRoundRobins"));
const VenueRoundRobinDetail = lazy(() => import("./pages/venue/VenueRoundRobinDetail"));
const VenueRoundRobinKiosk = lazy(() => import("./pages/venue/VenueRoundRobinKiosk"));
const PublicVenueLanding = lazy(() => import("./pages/PublicVenueLanding"));
const VenueInterestWizard = lazy(() => import("./pages/VenueInterestWizard"));
const PlayersLanding = lazy(() => import("./pages/PlayersLanding"));
const VenuesLanding = lazy(() => import("./pages/VenuesLanding"));

// Onboarding pages
const OnboardingProfileSetup = lazy(() => import("./pages/onboarding/ProfileSetup"));
const OnboardingFirstMatch = lazy(() => import("./pages/onboarding/FirstMatch"));
const OnboardingRatingReveal = lazy(() => import("./pages/onboarding/RatingReveal"));
const OnboardingComplete = lazy(() => import("./pages/onboarding/Complete"));

// Venue onboarding pages
const VenueOnboardingProfile = lazy(() => import("./pages/venue/onboarding/VenueOnboardingProfile"));
const VenueOnboardingFirstEvent = lazy(() => import("./pages/venue/onboarding/VenueOnboardingFirstEvent"));
const VenueOnboardingShare = lazy(() => import("./pages/venue/onboarding/VenueOnboardingShare"));
const VenueOnboardingComplete = lazy(() => import("./pages/venue/onboarding/VenueOnboardingComplete"));

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
  useAuthPersistence();

  // Listen for service worker updates and show toast
  useEffect(() => {
    const handleSWUpdate = () => {
      toast('Update available', {
        description: 'Refresh to get the latest version',
        action: {
          label: 'Refresh',
          onClick: () => window.location.reload()
        },
        duration: Infinity
      });
    };

    window.addEventListener('sw-update-available', handleSWUpdate);
    return () => window.removeEventListener('sw-update-available', handleSWUpdate);
  }, []);

  return (
    <>
      <ScrollToTop />
      <RoundRobinBanner />
      <PWAInstallPrompt />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/demo" element={<DemoTour />} />
          <Route path="/players" element={<PlayersLanding />} />
          <Route path="/venues" element={<VenuesLanding />} />
          
          {/* Onboarding routes - require auth but allow onboarding state */}
          <Route path="/onboarding/profile" element={
            <AuthGuard allowOnboarding><OnboardingProfileSetup /></AuthGuard>
          } />
          <Route path="/onboarding/first-match" element={
            <AuthGuard allowOnboarding><OnboardingFirstMatch /></AuthGuard>
          } />
          <Route path="/onboarding/rating" element={
            <AuthGuard allowOnboarding><OnboardingRatingReveal /></AuthGuard>
          } />
          <Route path="/onboarding/complete" element={
            <AuthGuard allowOnboarding><OnboardingComplete /></AuthGuard>
          } />
          
          {/* Public venue landing pages (white-label) */}
          <Route path="/v/:slug" element={<PublicVenueLanding />} />
          <Route path="/venue/:slug" element={<PublicVenueLanding />} />

          {/* Player routes with shell - require auth */}
          <Route path="/player" element={
            <AuthGuard>
              <PlayerShell />
            </AuthGuard>
          }>
            <Route index element={<Navigate to="/player/dashboard" replace />} />
            <Route path="dashboard" element={<PlayerDashboard />} />
            <Route path="find" element={<FindEvents />} />
            <Route path="events" element={<PlayerEvents />} />
            <Route path="courts" element={<PlayerCourts />} />
            <Route path="venues" element={<VenueDiscovery />} />
            <Route path="coaching" element={<PlayerCoaching />} />
            <Route path="bookings" element={<PlayerBookings />} />
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="my-events" element={<MyEvents />} />
            <Route path="community" element={<Community />} />
            <Route path="community/group/:groupId" element={<GroupDetail />} />
            <Route path="community/group/:groupId/manage" element={<GroupManage />} />
          </Route>

          {/* Venue routes with shell - require auth + venue access */}
          <Route path="/venue" element={
            <AuthGuard>
              <VenueGuard>
                <VenueShell />
              </VenueGuard>
            </AuthGuard>
          }>
            <Route index element={<VenueOverview />} />
            <Route path="profile" element={<VenueProfile />} />
            <Route path="branding" element={<VenueBranding />} />
            <Route path="facility" element={<VenueFacility />} />
            <Route path="media" element={<VenueMedia />} />
            <Route path="community" element={<VenueCommunity />} />
            <Route path="courts" element={<VenueCourts />} />
            <Route path="bookings" element={<VenueBookings />} />
            <Route path="events" element={<VenueEvents />} />
            <Route path="tournaments" element={<VenueTournaments />} />
            <Route path="round-robins" element={<VenueRoundRobins />} />
            <Route path="round-robins/:id" element={<VenueRoundRobinDetail />} />
            <Route path="coaching" element={<VenueCoaching />} />
            <Route path="staff" element={<VenueStaff />} />
            <Route path="settings" element={<VenueSettings />} />
            <Route path="analytics" element={<VenueAnalytics />} />
          </Route>
          
          {/* Venue onboarding routes - require auth but allow any venue state */}
          <Route path="/venue/onboarding" element={
            <AuthGuard><VenueOnboarding /></AuthGuard>
          } />
          <Route path="/venue/onboarding/profile" element={
            <AuthGuard><VenueGuard allowOnboarding><VenueOnboardingProfile /></VenueGuard></AuthGuard>
          } />
          <Route path="/venue/onboarding/first-event" element={
            <AuthGuard><VenueGuard allowOnboarding><VenueOnboardingFirstEvent /></VenueGuard></AuthGuard>
          } />
          <Route path="/venue/onboarding/share" element={
            <AuthGuard><VenueGuard allowOnboarding><VenueOnboardingShare /></VenueGuard></AuthGuard>
          } />
          <Route path="/venue/onboarding/complete" element={
            <AuthGuard><VenueGuard allowOnboarding><VenueOnboardingComplete /></VenueGuard></AuthGuard>
          } />
          <Route path="/venue/interest" element={<VenueInterestWizard />} />
          <Route path="/venue/create-fast" element={<AuthGuard><CreateVenueFast /></AuthGuard>} />
          <Route path="/venue/round-robins/:id/kiosk" element={<VenueRoundRobinKiosk />} />

          {/* Legacy routes - redirect to new structure */}
          <Route path="/dashboard" element={<Navigate to="/player/dashboard" replace />} />

          {/* Existing routes */}
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/profile/:userId" element={<ViewProfile />} />
          <Route path="/match/new" element={<NewMatch />} />
          <Route path="/match/pending" element={<PendingMatches />} />
          <Route path="/match/history" element={<MatchHistory />} />
          <Route path="/court/history" element={<CourtHistory />} />
          <Route path="/court/board" element={<CourtBoard />} />
          <Route path="/court/connector" element={<CourtConnector />} />
          <Route path="/pickleballciti" element={<Navigate to="/court/board/836003fb-fbd7-429c-8973-67ac6766a511" replace />} />
          <Route path="/masonfield" element={<Navigate to="/court/board/4a5d9fb8-981b-42f1-9504-595cb8f22fca" replace />} />
          <Route path="/tildastone" element={<Navigate to="/court/board/2bf21943-2efc-43fe-bab4-9bb7693d4674" replace />} />
          <Route path="/naymca" element={<Navigate to="/court/board/51e71be8-2212-4d46-9f83-d7f2d2af3120" replace />} />
          <Route path="/court/board/:courtId" element={<CourtBoard />} />
          <Route path="/court/feed/:postId" element={<PostDetail />} />
          <Route path="/settings/courts" element={<CourtSettings />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/session/queue" element={<SessionQueue />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/session" element={<AdminSession />} />
          <Route path="/admin/pairing" element={<AdminPairing />} />
          <Route path="/admin/players" element={<AdminPlayers />} />
          <Route path="/admin/badges" element={<AdminBadges />} />
          <Route path="/admin/matches" element={<AdminMatches />} />
          <Route path="/admin/marketing" element={<AdminMarketing />} />
          <Route path="/admin/audit-log" element={<AdminAuditLog />} />
          <Route path="/admin/test-accounts" element={<AdminTestAccounts />} />
          <Route path="/admin/biometrics" element={<AdminBiometrics />} />
          <Route path="/admin/system-health" element={<AdminSystemHealth />} />
          <Route path="/admin/manage/:sessionId" element={<AdminManage />} />
          <Route path="/match/ticket/:ticketId" element={<MatchTicket />} />
          <Route path="/qr-checkin" element={<QRCheckIn />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/changelog" element={<Changelog />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/events/my-calendar-registrations" element={<MyCalendarRegistrations />} />
          <Route path="/events/browse" element={<BrowseEvents />} />
          <Route path="/pickleball-citi-memberships" element={<PickleballCitiMemberships />} />
          <Route path="/profile/data-export" element={<DataExport />} />
          <Route path="/settings/notifications" element={<NotificationSettings />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/new" element={<NewEvent />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/events/:eventId/add-match" element={<EventMatchEntry />} />
          <Route path="/round-robin" element={<RoundRobinHub />} />
          <Route path="/round-robin/create" element={<CreateRoundRobin />} />
          <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
          <Route path="/round-robin/:id/kiosk" element={<RoundRobinKiosk />} />
          <Route path="/tournaments" element={<TournamentsLanding />} />
          <Route path="/tournaments/new" element={<TournamentNewWithGating />} />
          <Route path="/venue/create-fast" element={<CreateVenueFast />} />
          <Route path="/tournaments/:id" element={<TournamentDetail />} />
          <Route path="/tournaments/:id/divisions/:divisionId" element={<TournamentDivisionDetailNew />} />
          <Route path="/tournaments/:id/customize" element={<TournamentCustomize />} />
          <Route path="/tournaments/:id/payment-success" element={<TournamentPaymentSuccess />} />
          <Route path="/tournaments/:id/payment-cancelled" element={<TournamentPaymentCancelled />} />
          <Route path="/tournament/:slug" element={<TournamentLanding />} />
          <Route path="/tournament/:eventId/register" element={<TournamentRegister />} />
          <Route path="/my-registrations" element={<MyCalendarRegistrations />} />
          <Route path="/tournament/:eventId/live" element={<TournamentLiveView />} />
          <Route path="/tournament/:eventId/team/:teamId" element={<TournamentTeamView />} />
          <Route path="/tournament-admin" element={<TournamentAdmin />} />
          <Route path="/tournament-admin/:eventId/customize" element={<TournamentCustomize />} />
          <Route path="/tournament-admin/event/:eventId" element={<TournamentEventDetail />} />
          <Route path="/tournament-admin/event/:eventId/division/:divisionId" element={<TournamentDivisionDetail />} />
          <Route path="/tournament-admin/division/:divisionId" element={<TournamentDivisionDetail />} />
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
            <ModeProvider>
              <AppContent />
            </ModeProvider>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
