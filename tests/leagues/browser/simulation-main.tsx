import { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { PulseActivityBar } from "@/components/ui/pulse-activity";
import AdminLeagueDetail from "@/pages/admin/AdminLeagueDetail";
import PlayerLeagueDetail from "@/pages/player/PlayerLeagueDetail";
import PlayerLeagues from "@/pages/player/PlayerLeagues";
import JoinLeagueByCode from "@/pages/player/JoinLeagueByCode";
import { QaAuth } from "./simulation-client";
import "@/index.css";
const client = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
function Preview({
  state,
}: {
  state: { league: string; users: { id: string; name: string }[] };
}) {
  const [user, setUser] = useState(state.users[0].id);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const navigate = useNavigate();
  return (
    <QaAuth user={user}>
      <div className="flex flex-wrap gap-2 bg-slate-900 p-3 text-xs text-white">
        <strong className="w-full">
          ISOLATED SIMULATION · real league rules · fictional players
        </strong>
        <button
          className="rounded border p-2"
          onClick={() => navigate("/player/leagues")}
        >
          League hub
        </button>
        <button
          className="rounded border p-2"
          onClick={() => setDark((value) => !value)}
          aria-pressed={dark}
        >
          Dark theme
        </button>
        {[0, 1, 2, 3, 10].map((index) => (
          <button
            className="rounded border p-2"
            key={index}
            onClick={() => {
              client.clear();
              setUser(state.users[index].id);
              navigate(
                `/player/leagues/${state.league}${index < 2 ? "/manage?tab=ladder" : ""}`
              );
            }}
          >
            {state.users[index].name}
          </button>
        ))}
      </div>
      <Routes>
        <Route path="/player/leagues" element={<PlayerLeagues />} />
        <Route
          path="/player/leagues/join/:code"
          element={<JoinLeagueByCode />}
        />
        <Route
          path="/player/leagues/:leagueId/manage"
          element={<AdminLeagueDetail />}
        />
        <Route
          path="/player/leagues/:leagueId"
          element={<PlayerLeagueDetail />}
        />
      </Routes>
      <Toaster />
      <PulseActivityBar />
    </QaAuth>
  );
}
fetch("/__league-sim")
  .then((res) => res.json())
  .then((state) =>
    createRoot(document.getElementById("root")!).render(
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <MemoryRouter
            initialEntries={[
              `/player/leagues/${state.league}/manage?tab=ladder`,
            ]}
          >
            <Preview state={state} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    )
  );
