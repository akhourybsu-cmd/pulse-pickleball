import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  page: vi.fn(),
  profile: vi.fn(),
  calls: [] as Array<[string, ...unknown[]]>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));
import { fetchPlayerPulse } from "@/hooks/usePlayerPulse";
const raw = (id: string) => ({
  match_id: id,
  team: 1,
  rating_before: 3,
  rating_after: 3.01,
  rating_change: 0.01,
  matches: {
    match_date: "2026-10-01",
    created_at: "2026-10-01T12:00:00Z",
    team1_score: 11,
    team2_score: 7,
    status: "approved",
    voided: false,
    count_for_rating: true,
    source: "manual",
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.calls = [];
  mocks.profile.mockResolvedValue({
    data: { current_rating: 3.1 },
    error: null,
  });
  mocks.page.mockResolvedValue({ data: [raw("one")], error: null });
  mocks.from.mockImplementation((table: string) => {
    let start = 0,
      end = 499;
    const builder = {
      select: () => builder,
      eq: (...args: unknown[]) => {
        mocks.calls.push([table, ...args]);
        return builder;
      },
      not: (...args: unknown[]) => {
        mocks.calls.push([table, ...args]);
        return builder;
      },
      order: () => builder,
      range: (a: number, b: number) => {
        start = a;
        end = b;
        return builder;
      },
      abortSignal: (signal: AbortSignal) => {
        mocks.calls.push([table, "signal", signal]);
        return builder;
      },
      single: () => mocks.profile(),
      then: (resolve: unknown, reject: unknown) =>
        mocks.page(start, end).then(resolve, reject),
    };
    return builder;
  });
});
it("loads all 1,205 results through explicit bounded pages, with an account filter and abort signal", async () => {
  const all = Array.from({ length: 1205 }, (_, i) =>
    raw(String(i).padStart(5, "0"))
  );
  mocks.page.mockImplementation((start: number, end: number) =>
    Promise.resolve({ data: all.slice(start, end + 1), error: null })
  );
  const signal = new AbortController().signal;
  const result = await fetchPlayerPulse("player-a", signal);
  expect(result.matchCount).toBe(1205);
  expect(mocks.page.mock.calls).toEqual([
    [0, 499],
    [500, 999],
    [1000, 1499],
  ]);
  expect(mocks.calls).toContainEqual([
    "match_participants",
    "player_id",
    "player-a",
  ]);
  expect(mocks.calls).toContainEqual([
    "match_participants",
    "matches.count_for_rating",
    "is",
    false,
  ]);
  expect(
    mocks.calls.filter((c) => c[1] === "signal").every((c) => c[2] === signal)
  ).toBe(true);
});
it("rejects a failed later page instead of displaying a partial all-time history", async () => {
  mocks.page
    .mockResolvedValueOnce({
      data: Array.from({ length: 500 }, (_, i) => raw(String(i))),
      error: null,
    })
    .mockResolvedValueOnce({
      data: null,
      error: new Error("Later page failed"),
    });
  await expect(
    fetchPlayerPulse("a", new AbortController().signal)
  ).rejects.toThrow("Later page failed");
});
it("surfaces a failed profile read instead of quietly replacing the headline", async () => {
  mocks.profile.mockResolvedValueOnce({
    data: null,
    error: new Error("Profile unavailable"),
  });
  await expect(
    fetchPlayerPulse("a", new AbortController().signal)
  ).rejects.toThrow("Profile unavailable");
});
it("excludes unranked, voided and pending matches without fabricating missing scores", async () => {
  const unranked = raw("unranked"),
    voided = raw("voided"),
    pending = raw("pending"),
    missing = raw("missing");
  unranked.matches.count_for_rating = false;
  voided.matches.voided = true;
  pending.matches.status = "pending";
  mocks.page.mockResolvedValueOnce({
    data: [
      unranked,
      voided,
      pending,
      { ...missing, matches: { ...missing.matches, team1_score: null } },
    ],
    error: null,
  });
  const result = await fetchPlayerPulse("a", new AbortController().signal);
  expect(result.matches).toHaveLength(1);
  expect(result.matches[0].outcome).toBe("unscored");
  expect(result.matches[0].pointsFor).toBeNull();
});
