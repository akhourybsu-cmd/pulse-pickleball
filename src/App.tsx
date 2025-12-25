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
import { VenueShell } from "@/components/layout/VenueShell";

// Page imports
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import EditProfile from "./pages/EditProfile";
import ViewProfile from "./pages/ViewProfile";
import NewMatch from "./pages/NewMatch";
import PendingMatches from "./pages/PendingMatches";
import MatchHistory from "./pages/MatchHistory";
import CourtHistory from "./pages/CourtHistory";
import CourtBoard from "./pages/CourtBoard";
import CourtConnector from "./pages/CourtConnector";
import CourtSettings from "./pages/CourtSettings";
import PostDetail from "./pages/PostDetail";
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";
import SessionQueue from "./pages/SessionQueue";
import AdminSession from "./pages/AdminSession";
import AdminPairing from "./pages/AdminPairing";
import MatchTicket from "./pages/MatchTicket";
import QRCheckIn from "./pages/QRCheckIn";
import Kiosk from "./pages/Kiosk";
import AdminManage from "./pages/AdminManage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminPlayers from "./pages/AdminPlayers";
import AdminBadges from "./pages/AdminBadges";
import AdminMatches from "./pages/AdminMatches";
import AdminMarketing from "./pages/AdminMarketing";
import Changelog from "./pages/Changelog";
import Events from "./pages/Events";
import NewEvent from "./pages/NewEvent";
import EventDetail from "./pages/EventDetail";
import EventMatchEntry from "./pages/EventMatchEntry";
import DemoTour from "./pages/DemoTour";
import RoundRobinHub from "./pages/RoundRobinHub";
import CreateRoundRobin from "./pages/CreateRoundRobin";
import RoundRobinDetail from "./pages/RoundRobinDetail";
import RoundRobinKiosk from "./pages/RoundRobinKiosk";
import TournamentAdmin from "./pages/TournamentAdmin";
import TournamentEventDetail from "./pages/TournamentEventDetail";
import TournamentDivisionDetail from "./pages/TournamentDivisionDetail";
import TournamentLiveView from "./pages/TournamentLiveView";
import TournamentTeamView from "./pages/TournamentTeamView";
import Tournaments from "./pages/Tournaments";
import TournamentRegister from "./pages/TournamentRegister";
import TournamentLanding from "./pages/TournamentLanding";
import TournamentCustomize from "./pages/TournamentCustomize";
import Reservations from "./pages/Reservations";
import MyCalendarRegistrations from "./pages/MyCalendarRegistrations";
import BrowseEvents from "./pages/BrowseEvents";
import PickleballCitiMemberships from "./pages/PickleballCitiMemberships";
import DataExport from "./pages/DataExport";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminTestAccounts from "./pages/AdminTestAccounts";
import AdminBiometrics from "./pages/AdminBiometrics";
import { RoundRobinBanner } from "@/components/RoundRobinBanner";
import { ScrollToTop } from "@/components/ScrollToTop";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

// Player pages
import PlayerDashboard from "./pages/player/PlayerDashboard";
import PlayerCourts from "./pages/player/PlayerCourts";
import PlayerEvents from "./pages/player/PlayerEvents";
import PlayerCoaching from "./pages/player/PlayerCoaching";
import PlayerBookings from "./pages/player/PlayerBookings";
import VenueDiscovery from "./pages/player/VenueDiscovery";
import MyBookings from "./pages/player/MyBookings";
import MyEvents from "./pages/player/MyEvents";

// Venue pages
import VenueOverview from "./pages/venue/VenueOverview";
import VenueOnboarding from "./pages/venue/VenueOnboarding";
import VenueCourts from "./pages/venue/VenueCourts";
import VenueBookings from "./pages/venue/VenueBookings";
import VenueEvents from "./pages/venue/VenueEvents";
import VenueCoaching from "./pages/venue/VenueCoaching";
import VenueStaff from "./pages/venue/VenueStaff";
import VenueSettings from "./pages/venue/VenueSettings";
import VenueAnalytics from "./pages/venue/VenueAnalytics";
import VenueRoundRobins from "./pages/venue/VenueRoundRobins";
import VenueCreateRoundRobin from "./pages/venue/VenueCreateRoundRobin";
import VenueRoundRobinDetail from "./pages/venue/VenueRoundRobinDetail";
import VenueRoundRobinKiosk from "./pages/venue/VenueRoundRobinKiosk";
import PublicVenueLanding from "./pages/PublicVenueLanding";
import VenueInterestForm from "./pages/VenueInterestForm";
const queryClient = new QueryClient();

const AppContent = () => {
  useAuthPersistence();
  return (
    <>
      <ScrollToTop />
      <RoundRobinBanner />
      <PWAInstallPrompt />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/demo" element={<DemoTour />} />
        
        {/* Public venue landing pages (white-label) */}
        <Route path="/v/:slug" element={<PublicVenueLanding />} />
        <Route path="/venue/:slug" element={<PublicVenueLanding />} />

        {/* Player routes with shell */}
        <Route path="/player" element={<PlayerShell />}>
          <Route index element={<Navigate to="/player/dashboard" replace />} />
          <Route path="dashboard" element={<PlayerDashboard />} />
          <Route path="events" element={<PlayerEvents />} />
          <Route path="courts" element={<PlayerCourts />} />
          <Route path="venues" element={<VenueDiscovery />} />
          <Route path="coaching" element={<PlayerCoaching />} />
          <Route path="bookings" element={<PlayerBookings />} />
          <Route path="my-bookings" element={<MyBookings />} />
          <Route path="my-events" element={<MyEvents />} />
        </Route>

        {/* Venue routes with shell */}
        <Route path="/venue" element={<VenueShell />}>
          <Route index element={<VenueOverview />} />
          <Route path="courts" element={<VenueCourts />} />
          <Route path="bookings" element={<VenueBookings />} />
          <Route path="events" element={<VenueEvents />} />
          <Route path="round-robins" element={<VenueRoundRobins />} />
          <Route path="round-robins/create" element={<VenueCreateRoundRobin />} />
          <Route path="round-robins/:id" element={<VenueRoundRobinDetail />} />
          <Route path="coaching" element={<VenueCoaching />} />
          <Route path="staff" element={<VenueStaff />} />
          <Route path="settings" element={<VenueSettings />} />
          <Route path="analytics" element={<VenueAnalytics />} />
        </Route>
        <Route path="/venue/onboarding" element={<VenueOnboarding />} />
        <Route path="/venue/interest" element={<VenueInterestForm />} />
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
        <Route path="/events" element={<Events />} />
        <Route path="/events/new" element={<NewEvent />} />
        <Route path="/events/:eventId" element={<EventDetail />} />
        <Route path="/events/:eventId/add-match" element={<EventMatchEntry />} />
        <Route path="/round-robin" element={<RoundRobinHub />} />
        <Route path="/round-robin/create" element={<CreateRoundRobin />} />
        <Route path="/round-robin/:id" element={<RoundRobinDetail />} />
        <Route path="/round-robin/:id/kiosk" element={<RoundRobinKiosk />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournament/:slug" element={<TournamentLanding />} />
        <Route path="/tournament/:eventId/register" element={<TournamentRegister />} />
        <Route path="/my-registrations" element={<MyCalendarRegistrations />} />
        <Route path="/tournament/:eventId/live" element={<TournamentLiveView />} />
        <Route path="/tournament/:eventId/team/:teamId" element={<TournamentTeamView />} />
        <Route path="/tournament-admin" element={<TournamentAdmin />} />
        <Route path="/tournament-admin/:eventId/customize" element={<TournamentCustomize />} />
        <Route path="/tournament-admin/event/:eventId" element={<TournamentEventDetail />} />
        <Route path="/tournament-admin/division/:divisionId" element={<TournamentDivisionDetail />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
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
