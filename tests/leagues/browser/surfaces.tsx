import React from "react";
import { createRoot } from "react-dom/client";
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { MyLeaguesSection } from "@/components/dashboard/MyLeaguesSection";
import { UpNextLeagueMatchesSection } from "@/components/dashboard/UpNextLeagueMatchesSection";
import { VenueEventCard } from "@/components/venue/VenueEventCard";
import { InviteCodeCard } from "@/components/admin/leagues/InviteCodeCard";
import JoinLeagueByCode from "@/pages/player/JoinLeagueByCode";
import LeaguePoster from "@/pages/admin/LeaguePoster";
import type { League } from "@/lib/leagues/types";
import { league } from "./surfaces-stub";
import "@/index.css";

function Home() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-2xl space-y-5 p-4">
      <MyLeaguesSection />
      <UpNextLeagueMatchesSection />
      <h2 className="font-semibold">Venue events</h2>
      <VenueEventCard
        event={{
          id: "league",
          title: league.name,
          start_time: null,
          event_format: "league",
          league_type: "ladder",
          league_branding: league.branding,
          description: league.description,
        }}
        onPick={() => navigate("/player/leagues/league")}
      />
      <VenueEventCard
        event={{
          id: "fallback",
          title: "Neighborhood League With A Very Long Name",
          start_time: null,
          event_format: "league",
          league_type: "doubles",
        }}
      />
      <InviteCodeCard league={league as League} onMutated={() => {}} />
    </main>
  );
}
function Preview() {
  const location = useLocation();
  return (
    <>
      <nav className="flex flex-wrap gap-3 bg-slate-900 p-3 text-xs text-white">
        <strong className="w-full">
          ISOLATED DISPLAY QA · fictional fixtures, no live backend
        </strong>
        <Link to="/">Home cards</Link>
        <Link to="/player/leagues/join/COURTSIDE">Public invitation</Link>
        <Link to="/player/leagues/join/INVALID">Invalid invitation</Link>
        <Link to="/errors">Loading failures</Link>
        <Link to="/player/leagues/league/poster">Poster preview</Link>
      </nav>
      <output className="block break-all px-4 py-2 text-xs">
        Current route: {location.pathname}
        {location.search}
        {location.hash}
      </output>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/errors" element={<Home />} />
        <Route
          path="/player/leagues/join/:code"
          element={<JoinLeagueByCode />}
        />
        <Route
          path="/player/leagues/:leagueId/poster"
          element={<LeaguePoster />}
        />
        <Route
          path="*"
          element={
            <p className="p-5">Navigation destination verified above.</p>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
  >
    <TooltipProvider>
      <MemoryRouter>
        <Preview />
      </MemoryRouter>
    </TooltipProvider>
  </QueryClientProvider>
);
