import React from "react";
import { createRoot } from "react-dom/client";
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import MatchHistory from "../../../src/pages/MatchHistory";
import { PlayerShell } from "../../../src/components/layout/PlayerShell";
import { ActiveViewProvider } from "../../../src/contexts/ActiveViewContext";
import "../../../src/index.css";

const params = new URLSearchParams(window.location.search);
const client = new QueryClient();
function Destination() {
  const location = useLocation();
  return (
    <div className="p-5">
      <h1>Local navigation check</h1>
      <p>{location.pathname}</p>
      <Link to="/player/matches">Back to your matches</Link>
      <br />
      <Link to="/player/matches?player=demo-2">
        View Taylor’s match history
      </Link>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <ThemeProvider
      attribute="class"
      forcedTheme={params.has("light") ? "light" : "dark"}
    >
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            `/player/matches${params.has("other") ? "?player=demo-2" : ""}`,
          ]}
        >
          <ActiveViewProvider>
            <Routes>
              <Route element={<PlayerShell />}>
                <Route path="/player/matches" element={<MatchHistory />} />
                <Route path="*" element={<Destination />} />
              </Route>
            </Routes>
            <Toaster />
          </ActiveViewProvider>
        </MemoryRouter>
      </HelmetProvider>
    </ThemeProvider>
  </QueryClientProvider>
);
