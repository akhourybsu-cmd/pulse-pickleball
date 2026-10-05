import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { buildPlayerPulse, type PulseMatchRow } from "@/lib/playerPulse";
import { clearAccountSession } from "@/lib/accountSession";
const mocks = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
  user: "a",
}));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: mocks.user }, loading: false }),
}));
vi.mock("@/hooks/usePlayerPulse", () => ({
  usePlayerPulse: () => ({ ...mocks.query, refetch: mocks.refetch }),
}));
vi.mock("@/components/seo/PageSEO", () => ({ PageSEO: () => null }));
vi.mock("@/components/player/PulseTrendChart", () => ({
  default: ({ data }: { data: unknown[] }) => (
    <div data-chart-points={data.length} />
  ),
}));
import PlayerPulse from "@/pages/player/PlayerPulse";
let renderer: ReactTestRenderer;
const rows: PulseMatchRow[] = Array.from({ length: 12 }, (_, i) => ({
  matchId: String(i).padStart(2, "0"),
  matchDate: "2026-01-01",
  createdAt: "2026-01-01T12:00:00Z",
  team: 1,
  team1Score: 11,
  team2Score: 7,
  ratingBefore: 3,
  ratingAfter: i === 11 ? null : 3.01,
  ratingChange: i === 11 ? null : i === 10 ? 0 : 0.01,
  source: "manual",
}));
const data = () => buildPlayerPulse(rows, { currentRating: 3.01 }, Date.now());
const text = () => JSON.stringify(renderer.toJSON());
async function mount() {
  await act(async () => {
    renderer = create(
      <MemoryRouter>
        <PlayerPulse />
      </MemoryRouter>
    );
  });
}
function button(label: string) {
  return renderer.root.findAllByType("button").find(
    (node) =>
      node.children
        .filter((child) => typeof child === "string")
        .join("")
        .trim() === label.trim()
  )!;
}
beforeEach(() => {
  clearAccountSession();
  vi.clearAllMocks();
  mocks.user = "a";
  mocks.query = {
    data: data(),
    isLoading: false,
    isFetching: false,
    isError: false,
  };
});
afterEach(() => {
  act(() => renderer?.unmount());
  clearAccountSession();
});
it("shows a recoverable loading error instead of saying the user has no matches", async () => {
  mocks.query = { isError: true, isLoading: false };
  await mount();
  expect(text()).toContain("Player Pulse couldn’t load");
  expect(text()).not.toContain("Your story starts");
  await act(async () => button("Try again").props.onClick());
  expect(mocks.refetch).toHaveBeenCalledOnce();
});
it("labels stale data when refresh fails and retains the existing results", async () => {
  mocks.query.isError = true;
  await mount();
  expect(text()).toContain("Showing the last loaded data");
  expect(text()).toContain("Rating journey");
});
it("filters every performance section to the same last ten results and keeps the selected range on return", async () => {
  await mount();
  await act(async () => button("Last 10").props.onClick());
  expect(
    renderer.root.findByProps({ "aria-label": "Last 10 results summary" })
  ).toBeTruthy();
  expect(renderer.root.findByProps({ "data-chart-points": 9 })).toBeTruthy();
  act(() => renderer.unmount());
  await mount();
  expect(button("Last 10").props["aria-pressed"]).toBe(true);
  mocks.user = "b";
  act(() => renderer.unmount());
  await mount();
  expect(button("All time").props["aria-pressed"]).toBe(true);
});
it("distinguishes an unavailable change from a recorded zero and dates every result", async () => {
  await mount();
  expect(text()).toContain("0.000");
  expect(text()).toContain("Change not recorded");
  expect(text()).toContain("Jan 1, 2026");
  expect(text()).not.toContain("Holding steady");
});
it("allows a single recorded result to appear in the chart and data table", async () => {
  mocks.query.data = buildPlayerPulse(
    [rows[0]],
    { currentRating: 3.01 },
    Date.now()
  );
  await mount();
  expect(renderer.root.findByProps({ "data-chart-points": 1 })).toBeTruthy();
  await act(async () => button("View chart data ").props.onClick());
  expect(renderer.root.findAllByType("table")).toHaveLength(1);
});
it("offers a clear empty-period recovery without hiding the all-time score", async () => {
  await mount();
  await act(async () => button("30 days").props.onClick());
  expect(text()).toContain("No ranked results in this period");
  await act(async () => button("Show all time").props.onClick());
  expect(button("All time").props["aria-pressed"]).toBe(true);
});
