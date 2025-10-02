import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
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
import FAQ from "./pages/FAQ";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile/edit" element={<EditProfile />} />
            <Route path="/profile/:userId" element={<ViewProfile />} />
            <Route path="/match/new" element={<NewMatch />} />
            <Route path="/match/pending" element={<PendingMatches />} />
            <Route path="/match/history" element={<MatchHistory />} />
            <Route path="/court/history" element={<CourtHistory />} />
            <Route path="/court/board" element={<CourtBoard />} />
            <Route path="/faq" element={<FAQ />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
