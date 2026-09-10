// Local-only fixture. Checkout is off and all data is non-personal sample data.
import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "@tanstack/react-query";
import { VenueModulesPanel } from "../../src/components/venue/VenueModulesPanel";
import "../../src/index.css";

onlineManager.setOnline(false);
const query = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
const venue = "00000000-0000-4000-8000-000000000001";
const params = new URLSearchParams(window.location.search);
if (params.has("dark")) document.documentElement.classList.add("dark");
const previewWidth = params.get("width") === "320" ? 320 : 390;
query.setQueryData(
  ["venue-modules", venue],
  ["court_booking", "facility_tools"].map((module_key) => ({
    module_key,
    source: "existing_venue",
    enabled: false,
    expires_at: null,
  })),
  { updatedAt: Date.now() + 86400000 }
);
query.setQueryData(
  ["payment-config"],
  { mode: "off", livemode: false, cadence: "monthly" },
  { updatedAt: Date.now() + 86400000 }
);
createRoot(document.getElementById("root")!).render(
  params.has("mobile") ? (
    <iframe
      title={`${previewWidth}px mobile upgrade preview`}
      width={previewWidth}
      height={params.has("short") ? 640 : 844}
      className="mx-auto block border"
      src={
        "./upgrade-preview.html?owner=1&verified=1" +
        (params.has("dark") ? "&dark=1" : "") +
        (params.has("features") ? "#venue-upgrades" : "")
      }
    />
  ) : (
    <QueryClientProvider client={query}>
      <MemoryRouter>
        <div
          onClickCapture={(event) => {
            const link = (event.target as HTMLElement).closest("a");
            if (link?.getAttribute("href")?.startsWith("/player")) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
        >
          <p className="border-b bg-muted p-3 text-center text-xs">
            Local preview · sample venue · checkout disabled
          </p>
          <main className="mx-auto max-w-5xl p-4 sm:p-8">
            <VenueModulesPanel
              venueId={venue}
              venueName="Pickleball Palace · Preview venue"
              verified={params.has("verified")}
              canVerify={params.has("owner")}
            />
          </main>
        </div>
      </MemoryRouter>
    </QueryClientProvider>
  )
);
