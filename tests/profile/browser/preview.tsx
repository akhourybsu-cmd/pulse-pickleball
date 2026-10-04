import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  MemoryRouter,
  Routes,
  Route,
  Link,
  useLocation,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import PlayerProfile from "../../../src/pages/player/PlayerProfile";
import EditProfile from "../../../src/pages/EditProfile";
import NotificationSettings from "../../../src/pages/NotificationSettings";
import SecuritySettings from "../../../src/pages/SecuritySettings";
import DataExport from "../../../src/pages/DataExport";
import BlockedUsers from "../../../src/pages/BlockedUsers";
import {
  ACCOUNT_PATHS,
  accountTabDestination,
  writeAccountState,
} from "../../../src/lib/accountSession";
import "../../../src/index.css";
const client = new QueryClient();
if (new URLSearchParams(window.location.search).has("large-text"))
  document.documentElement.style.fontSize = "20px";
if (new URLSearchParams(window.location.search).has("dark"))
  document.documentElement.classList.add("dark");
function Preview() {
  const location = useLocation();
  useEffect(() => {
    if (ACCOUNT_PATHS.has(location.pathname))
      writeAccountState("sample-player", "last-page", location.pathname);
  }, [location.pathname]);
  return (
    <>
      <nav className="sticky top-0 z-50 flex gap-5 bg-secondary p-4 text-secondary-foreground">
        <Link to="/other">Other tab</Link>
        <Link to={accountTabDestination("sample-player", location.pathname)}>
          Profile tab
        </Link>
      </nav>
      <Routes>
        <Route path="/player/profile" element={<PlayerProfile />} />
        <Route path="/player/profile/edit" element={<EditProfile />} />
        <Route
          path="/player/profile/notifications"
          element={<NotificationSettings />}
        />
        <Route path="/player/profile/security" element={<SecuritySettings />} />
        <Route path="/player/profile/data-export" element={<DataExport />} />
        <Route path="/player/profile/blocked" element={<BlockedUsers />} />
        <Route
          path="*"
          element={
            <p className="p-6">Another tab. Return to Profile to resume.</p>
          }
        />
      </Routes>
      <Toaster />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={["/player/profile"]}>
      <Preview />
    </MemoryRouter>
  </QueryClientProvider>
);
