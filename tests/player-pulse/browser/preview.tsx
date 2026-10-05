import React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Link, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import PlayerPulse from "../../../src/pages/player/PlayerPulse";
import { scenario } from "./stub";
import "../../../src/index.css";
const params = new URLSearchParams(window.location.search);
if (params.has("dark")) document.documentElement.classList.add("dark");
if (params.has("large-text")) document.documentElement.style.fontSize = "20px";
createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <MemoryRouter initialEntries={["/player/pulse"]}>
      <nav className="flex flex-wrap items-center gap-4 bg-secondary p-3 text-xs text-secondary-foreground">
        <span>Isolated fictional data</span>
        <label>
          Scenario{" "}
          <select
            className="ml-1 rounded bg-background p-2 text-foreground"
            value={scenario}
            onChange={(e) => {
              params.set("scenario", e.target.value);
              window.location.search = params.toString();
            }}
          >
            {[
              "established",
              "empty",
              "single",
              "inactive",
              "missing",
              "long",
              "error",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <Link to="/other">Other tab</Link>
        <Link to="/player/pulse">Player Pulse tab</Link>
      </nav>
      <Routes>
        <Route path="/player/pulse" element={<PlayerPulse />} />
        <Route
          path="*"
          element={
            <p className="p-8">Another screen. Return to Player Pulse.</p>
          }
        />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>
);
