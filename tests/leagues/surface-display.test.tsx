import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { VenueEventCard } from "@/components/venue/VenueEventCard";
import { UpNextLeagueMatchesCard } from "@/components/dashboard/UpNextLeagueMatchesCard";
import { UpNextLeagueMatchesSection } from "@/components/dashboard/UpNextLeagueMatchesSection";

const state = vi.hoisted(() => ({ error: null as string | null }));
vi.mock("@/hooks/useLeagueEntitlement", () => ({
  useLeagueEntitlement: () => ({ entitled: true }),
}));
vi.mock("@/hooks/useMyUpcomingLeagueMatches", () => ({
  useMyUpcomingLeagueMatches: () => ({
    loading: false,
    error: state.error,
    retry() {},
    rows: [
      {
        match_id: "match",
        league_id: "league",
        league_name: "Courtside",
        league_type: "ladder",
        season_id: "fall",
        season_name: "Autumn",
        scheduled_time: null,
        has_match_time: false,
        session_date: "2027-02-01",
        session_start_time: "18:30:00",
        court_number: 2,
        location: "North courts",
        league_branding: { logo_url: "/club.png", primary_color: "#2563eb" },
        team_a_name: "Avery & Blake",
        team_b_name: "Casey & Devon",
      },
    ],
  }),
}));

it("shows league branding and format on venue cards without inventing a free entry fee", () => {
  const html = renderToStaticMarkup(
    <VenueEventCard
      event={{
        id: "league",
        title: "Courtside",
        start_time: null,
        event_format: "league",
        league_type: "ladder",
        league_branding: { logo_url: "/club.png", primary_color: "#2563eb" },
      }}
    />
  );
  for (const text of [
    'src="/club.png"',
    'alt="Courtside logo"',
    "Ladder league",
    "View season",
  ])
    expect(html).toContain(text);
  expect(html).not.toContain("Free");
});
it("shows a distinct unscheduled event label and a league fallback mark when no image exists", () => {
  expect(
    renderToStaticMarkup(
      <VenueEventCard
        event={{ id: "event", title: "Clinic", start_time: null }}
      />
    )
  ).toContain("Schedule to be announced");
  expect(
    renderToStaticMarkup(
      <VenueEventCard
        event={{
          id: "league",
          title: "Courtside Ladder",
          start_time: null,
          event_format: "league",
        }}
      />
    )
  ).toContain(">CL</span>");
});
it("carries session time, actual participants, branding and location to the home match card", () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <UpNextLeagueMatchesCard />
    </MemoryRouter>
  );
  for (const text of [
    'src="/club.png"',
    "Mon Feb 1 · 6:30 PM",
    "Court 2",
    "Avery &amp; Blake",
    "Casey &amp; Devon",
    "North courts",
    "Autumn",
  ])
    expect(html).toContain(text);
});
it("shows a retry action instead of silently hiding a failed home query", () => {
  state.error = "Query failed";
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <UpNextLeagueMatchesSection />
    </MemoryRouter>
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Try again");
  state.error = null;
});
