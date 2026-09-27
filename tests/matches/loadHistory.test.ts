import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HistoryRow } from "@/lib/matchHistory";
import { loadMatchHistory } from "@/lib/loadMatchHistory";

const mock = vi.hoisted(() => ({
  rows: [] as unknown[],
  calls: [] as {
    table: string;
    filters: Record<string, unknown>;
    range?: number[];
  }[],
  fail: "",
  statuses: [] as string[],
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const call = {
        table,
        filters: {} as Record<string, unknown>,
        range: undefined as number[] | undefined,
      };
      let select = "";
      const builder = {
        select(value: string) {
          select = value;
          return builder;
        },
        eq(key: string, value: unknown) {
          call.filters[key] = value;
          return builder;
        },
        in(key: string, value: unknown) {
          call.filters[key] = value;
          return builder;
        },
        not(key: string, op: string, value: unknown) {
          call.filters[`not:${key}:${op}`] = value;
          return builder;
        },
        order() {
          return builder;
        },
        range(start: number, end: number) {
          call.range = [start, end];
          return builder;
        },
        abortSignal() {
          return builder;
        },
        maybeSingle() {
          return builder;
        },
        then(resolve: (value: unknown) => void) {
          mock.calls.push(call);
          const error = mock.fail === table ? { message: "Read failed" } : null;
          let data: unknown = [];
          if (table === "profiles_public")
            data = { display_name: "Alex", avatar_url: null };
          if (
            table === "match_participants" &&
            select.includes("matches!inner")
          ) {
            mock.statuses = call.filters["matches.status"] as string[];
            data = mock.rows.slice(call.range![0], call.range![1] + 1);
          } else if (table === "match_participants")
            data = (call.filters.match_id as string[]).flatMap((match_id) => [
              {
                match_id,
                player_id: "me",
                team: 1,
                profiles: { display_name: "Alex" },
              },
              {
                match_id,
                player_id: "other",
                team: 2,
                profiles: { display_name: "Jordan" },
              },
            ]);
          if (table === "match_approvals")
            data = (call.filters.match_id as string[]).flatMap((match_id) => [
              { match_id, player_id: "me", approved: null },
              { match_id, player_id: "other", approved: true },
            ]);
          resolve({ data: error ? null : data, error });
        },
      };
      return builder;
    },
  },
}));
const row = (id: number, status = "approved"): HistoryRow => ({
  match_id: `m${id}`,
  team: 1,
  rating_change: 0.00123456,
  rating_after: 4,
  matches: {
    status,
    match_date: "2026-09-26",
    created_at: "2026-09-26T10:00:00Z",
    team1_score: 11,
    team2_score: 9,
    source: "casual",
    voided: false,
    count_for_rating: true,
    other_location: "Park",
    courts: null,
    verified_by: ["me"],
    round_no: null,
    court_no: null,
  },
});
beforeEach(() => {
  mock.rows = [];
  mock.calls = [];
  mock.fail = "";
  mock.statuses = [];
});
describe("match history loading", () => {
  it("reads beyond a full page without per-match requests and filters voided matches", async () => {
    mock.rows = Array.from({ length: 205 }, (_, i) => row(i));
    const data = await loadMatchHistory(
      "me",
      true,
      new AbortController().signal
    );
    expect(data.matches).toHaveLength(205);
    expect(
      mock.calls.filter((call) => call.range).map((call) => call.range)
    ).toEqual([
      [0, 199],
      [200, 399],
    ]);
    expect(
      mock.calls.filter(
        (call) => call.table === "match_participants" && !call.range
      )
    ).toHaveLength(3);
    for (const call of mock.calls.filter((call) => call.range))
      expect(call.filters).toMatchObject({
        player_id: "me",
        "not:matches.voided:is": true,
      });
  });
  it("never requests private pending matches or approvals for another player", async () => {
    mock.rows = [row(1)];
    const data = await loadMatchHistory(
      "other",
      false,
      new AbortController().signal
    );
    expect(mock.statuses).toEqual(["approved"]);
    expect(mock.calls.some((call) => call.table === "match_approvals")).toBe(
      false
    );
    expect(data.pendingMatches).toEqual([]);
    expect(mock.calls.find((call) => call.range)?.filters.player_id).toBe(
      "other"
    );
  });
  it("loads approvals for your pending matches and keeps them separate", async () => {
    mock.rows = [row(1), row(2, "pending")];
    const data = await loadMatchHistory(
      "me",
      true,
      new AbortController().signal
    );
    expect(data.matches).toHaveLength(1);
    expect(data.pendingMatches).toHaveLength(1);
    expect(data.pendingMatches[0].verified_by).toEqual(["other"]);
    expect(
      mock.calls.find((call) => call.table === "match_approvals")?.filters
        .match_id
    ).toEqual(["m2"]);
  });
  it("surfaces read errors rather than presenting a false empty history", async () => {
    mock.fail = "match_participants";
    await expect(
      loadMatchHistory("me", true, new AbortController().signal)
    ).rejects.toMatchObject({ message: "Read failed" });
  });
});
