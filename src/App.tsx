import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
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
import MyRegistrations from "./pages/MyRegistrations";
import TournamentLanding from "./pages/TournamentLanding";
import TournamentCustomize from "./pages/TournamentCustomize";
import { RoundRobinBanner } from "@/components/RoundRobinBanner";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        <ErrorBoundary>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RoundRobinBanner />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/demo" element={<DemoTour />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile/edit" element={<EditProfile />} />
              <Route path="/profile/:userId" element={<ViewProfile />} />
              <Route path="/match/new" element={<NewMatch />} />
              <Route path="/match/pending" element={<PendingMatches />} />
              <Route path="/match/history" element={<MatchHistory />} />
              <Route path="/court/history" element={<CourtHistory />} />
              <Route path="/court/board" element={<CourtBoard />} />
            <Route path="/court/connector" element={<CourtConnector />} />
            <Route path="/pickleballciti" element={<CourtConnector />} />
            <Route path="/court/board/:courtId" element={<CourtBoard />} />
            <Route path="/court/feed/:postId" element={<PostDetail />} />
            <Route path="/court/history" element={<CourtHistory />} />
            <Route path="/settings/courts" element={<CourtSettings />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/session/queue" element={<SessionQueue />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/session" element={<AdminSession />} />
              <Route path="/admin/sessions" element={<AdminSession />} />
              <Route path="/admin/pairing" element={<AdminPairing />} />
              <Route path="/admin/players" element={<AdminPlayers />} />
              <Route path="/admin/badges" element={<AdminBadges />} />
              <Route path="/admin/matches" element={<AdminMatches />} />
              <Route path="/admin/marketing" element={<AdminMarketing />} />
              <Route path="/admin/manage/:sessionId" element={<AdminManage />} />
              <Route path="/match/ticket/:ticketId" element={<MatchTicket />} />
              <Route path="/qr-checkin" element={<QRCheckIn />} />
              <Route path="/kiosk" element={<Kiosk />} />
              <Route path="/changelog" element={<Changelog />} />
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
              <Route path="/my-registrations" element={<MyRegistrations />} />
              <Route path="/tournament/:eventId/live" element={<TournamentLiveView />} />
              <Route path="/tournament/:eventId/team/:teamId" element={<TournamentTeamView />} />
              <Route path="/tournament-admin" element={<TournamentAdmin />} />
              <Route path="/tournament-admin/:eventId/customize" element={<TournamentCustomize />} />
              <Route path="/tournament-admin/event/:eventId" element={<TournamentEventDetail />} />
              <Route path="/tournament-admin/division/:divisionId" element={<TournamentDivisionDetail />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
