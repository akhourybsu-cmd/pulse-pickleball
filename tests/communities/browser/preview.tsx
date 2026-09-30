import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Community from "@/pages/player/Community";
import PublicCommunities from "@/pages/public/PublicCommunities";
import "@/index.css";
function Destination() {
  const navigate = useNavigate();
  return (
    <div className="p-6">
      <h1>Local community destination</h1>
      <button onClick={() => navigate(-1)}>Back</button>
    </div>
  );
}
const params = new URLSearchParams(window.location.search);
if (params.has("dark")) document.documentElement.classList.add("dark");
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={new QueryClient()}>
    <MemoryRouter>
      <p className="p-2 text-xs text-muted-foreground">
        LOCAL QA - no live writes
      </p>
      <Routes>
        <Route
          path="/"
          element={params.has("guest") ? <PublicCommunities /> : <Community />}
        />
        <Route path="/player/community/group/:id" element={<Destination />} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>,
);
