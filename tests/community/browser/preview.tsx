import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GroupDetail from "../../../src/pages/player/GroupDetail";
import { CommunityHero } from "../../../src/components/community/CommunityHero";
import { GroupCard } from "../../../src/components/community/GroupCard";
import { community, scenario } from "./stub";
import "../../../src/index.css";
if (new URLSearchParams(location.search).has("dark"))
  document.documentElement.classList.add("dark");
const query = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={query}>
    <BrowserRouter>
      <div className="fixed bottom-0 right-0 z-[80] rounded-tl bg-foreground px-2 py-1 text-[9px] text-background">
        Local QA · no live data
      </div>
      {scenario === "public" ? (
        <div className="mx-auto max-w-6xl p-4">
          <CommunityHero group={community as never} />
        </div>
      ) : scenario === "cards" ? (
        <div className="mx-auto grid max-w-5xl gap-5 p-6 md:grid-cols-3">
          {["crew", "league", "open_play"].map((type) => (
            <GroupCard
              key={type}
              group={
                {
                  ...community,
                  id: type,
                  type,
                  membership: { status: "active", role: "member" },
                } as never
              }
            />
          ))}
        </div>
      ) : (
        <Routes>
          <Route path="*" element={<GroupDetail />} />
        </Routes>
      )}
    </BrowserRouter>
  </QueryClientProvider>
);
