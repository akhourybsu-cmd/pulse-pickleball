import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import JoinLeagueByCode from "@/pages/player/JoinLeagueByCode";
import PlayerByHandle from "@/pages/PlayerByHandle";
import { JoinByCodeDialog } from "@/components/leagues/JoinByCodeDialog";
import { JoinGroupDialog } from "@/components/community/JoinGroupDialog";
import { Button } from "@/components/ui/button";
import { actions, signIn } from "./stub";
import "../../../src/index.css";
function Home() {
  const [league, setLeague] = useState(false),
    [group, setGroup] = useState(false);
  return (
    <main className="mx-auto max-w-md space-y-4 p-5">
      <h1 className="text-xl font-bold">Local share and join checks</h1>
      <p>Isolated fixture. No production requests.</p>
      {["FALL", "CLOSED", "INVALID", "RETRY"].map((code) => (
        <Button key={code} asChild className="w-full">
          <Link to={`/player/leagues/join/${code}`}>{code} invitation</Link>
        </Button>
      ))}
      <Button onClick={() => setLeague(true)}>Enter league code</Button>
      <Button onClick={() => setGroup(true)}>Enter group code</Button>
      <Button asChild>
        <Link to="/u/avery">Old player QR link</Link>
      </Button>
      <JoinByCodeDialog open={league} onOpenChange={setLeague} />
      <JoinGroupDialog
        open={group}
        onOpenChange={setGroup}
        onJoin={async () => {
          throw new Error("Offline fixture");
        }}
      />
    </main>
  );
}
function SignInPreview() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  return (
    <main className="mx-auto max-w-md space-y-5 p-6">
      <h1 className="text-2xl font-bold">
        Local {params.get("mode")} simulation
      </h1>
      <p className="break-all">{params.get("redirect")}</p>
      <Button
        onClick={() => {
          signIn();
          navigate(params.get("redirect")!);
        }}
      >
        Complete test sign-in
      </Button>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider attribute="class" defaultTheme="light">
        <MemoryRouter>
          <nav className="p-3 text-sm">
            <Link to="/">QA scenarios</Link>
          </nav>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/player/leagues/join/:code"
              element={<JoinLeagueByCode />}
            />
            <Route path="/auth" element={<SignInPreview />} />
            <Route path="/u/:handle" element={<PlayerByHandle />} />
            <Route
              path="*"
              element={
                <main className="p-6">
                  <h1>Destination loaded</h1>
                  <p>{actions.join("; ")}</p>
                </main>
              }
            />
          </Routes>
        </MemoryRouter>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
