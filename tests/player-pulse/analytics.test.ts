import { describe, expect, it } from "vitest";
import {
  buildPlayerPulse,
  computeConfidence,
  computeMomentum,
  computeThirtyDayChange,
  filterPulseMatches,
  formatPulseDate,
  formatPulseDelta,
  summarizePulseMatches,
  type PulseMatchRow,
} from "@/lib/playerPulse";

const now = new Date(2026, 9, 5, 12).getTime();
export const row = (changes: Partial<PulseMatchRow> = {}): PulseMatchRow => ({
  matchId: "a",
  matchDate: "2026-10-05",
  createdAt: "2026-10-05T12:00:00Z",
  team: 1,
  team1Score: 11,
  team2Score: 7,
  ratingBefore: 3,
  ratingAfter: 3.0234,
  ratingChange: 0.0234,
  source: "manual",
  ...changes,
});
const build = (rows: PulseMatchRow[]) =>
  buildPlayerPulse(rows, { currentRating: null }, now);

describe("Player Pulse recorded analytics", () => {
  it("keeps fractional rating precision and labels missing changes differently from zero", () => {
    const result = build([
      row(),
      row({
        matchId: "b",
        ratingBefore: 3.0234,
        ratingAfter: 3.0234,
        ratingChange: 0,
      }),
      row({ matchId: "c", ratingAfter: null, ratingChange: null }),
    ]);
    expect(result.timeline[0].rating).toBe(3.0234);
    expect(result.missingSnapshotCount).toBe(1);
    expect(result.ratedMatchCount).toBe(2);
    expect(formatPulseDelta(null)).toBe("—");
    expect(formatPulseDelta(0)).toBe("0.000");
    expect(formatPulseDelta(-0.00001)).toBe("0.000");
    expect(formatPulseDelta(0.0042)).toBe("+0.004");
  });
  it("orders ties by match ID exactly like the rating engine and deduplicates rows", () => {
    const result = build([
      row({ matchId: "b", ratingAfter: 3.2 }),
      row({ matchId: "a", ratingAfter: 3.1 }),
      row({ matchId: "a", ratingAfter: 3.1 }),
    ]);
    expect(result.matches.map((r) => r.matchId)).toEqual(["a", "b"]);
    expect(result.currentRating).toBe(3.2);
    expect(result.matchCount).toBe(2);
  });
  it("uses team-relative scores and never treats a draw or missing score as a loss", () => {
    const result = build([
      row({ matchId: "a", team: 2 }),
      row({ matchId: "b", team1Score: 8, team2Score: 8 }),
      row({ matchId: "c", team1Score: null }),
      row({ matchId: "d" }),
    ]);
    const stats = summarizePulseMatches(result.matches);
    expect(result.matches[0].scoreLabel).toBe("7–11");
    expect(stats).toMatchObject({
      wins: 1,
      losses: 1,
      draws: 1,
      unscored: 1,
      scoredCount: 3,
      pointsFor: 26,
      pointsAgainst: 26,
      winRate: 33,
      avgPointDiff: 0,
    });
  });
  it("does not make nonfinite snapshots into a zero rating or milestone", () => {
    const result = build([row({ ratingAfter: NaN, ratingChange: Infinity })]);
    expect(result.currentRating).toBeNull();
    expect(result.personalBest).toBeNull();
    expect(result.timeline).toEqual([]);
    expect(result.matches[0].ratingChange).toBeNull();
  });
  it("reports no activity and missing baselines as unknown rather than holding steady", () => {
    expect(
      computeThirtyDayChange([row({ matchDate: "2026-08-01" })], now)
    ).toBeNull();
    expect(
      computeThirtyDayChange([row({ ratingBefore: null })], now)
    ).toBeNull();
    expect(
      computeThirtyDayChange([row({ ratingAfter: null })], now)
    ).toBeNull();
    expect(
      computeThirtyDayChange(
        [row({ ratingBefore: 3, ratingAfter: 3, ratingChange: 0 })],
        now
      )
    ).toBe(0);
  });
  it("measures the full selected month from the first before value without rounding each game", () => {
    const rows = [
      row({
        matchId: "a",
        matchDate: "2026-09-06",
        ratingBefore: 3,
        ratingAfter: 3.004,
      }),
      row({ matchId: "b", ratingBefore: 3.004, ratingAfter: 3.008 }),
    ];
    expect(computeThirtyDayChange(rows, now)).toBeCloseTo(0.008, 8);
  });
  it("includes the start calendar day, excludes older and future dates, and keeps date-only labels local", () => {
    const result = build([
      row({ matchId: "old", matchDate: "2026-09-05" }),
      row({ matchId: "edge", matchDate: "2026-09-06" }),
      row({ matchId: "today" }),
      row({ matchId: "future", matchDate: "2026-10-06" }),
    ]);
    expect(
      filterPulseMatches(result.matches, "30d", now).map((r) => r.matchId)
    ).toEqual(["edge", "today"]);
    expect(formatPulseDate("2026-10-05")).toBe("Oct 5, 2026");
  });
  it("last ten means ten results, including missing rating data, across all summaries", () => {
    const result = build(
      Array.from({ length: 12 }, (_, i) =>
        row({
          matchId: String(i).padStart(2, "0"),
          ratingAfter: i >= 10 ? null : 3 + i / 100,
        })
      )
    );
    const selected = filterPulseMatches(result.matches, "last10", now);
    expect(selected).toHaveLength(10);
    expect(selected[0].matchId).toBe("02");
    expect(summarizePulseMatches(selected).wins).toBe(10);
    expect(
      result.timeline.filter((r) =>
        selected.some((s) => r.matchId === s.matchId)
      )
    ).toHaveLength(8);
  });
  it("keeps the provisional progress bar monotonic and uses the actual five/eight match boundaries", () => {
    const values = Array.from({ length: 25 }, (_, n) => computeConfidence(n));
    expect(values[4].label).toBe("Placement in progress");
    expect(values[5].label).toBe("Provisional rating");
    expect(values[8].label).toBe("Established rating");
    expect(
      values.every(
        (v, i) =>
          v.progress >= 0 &&
          v.progress <= 1 &&
          (i === 0 || v.progress >= values[i - 1].progress)
      )
    ).toBe(true);
    expect(values[24].progress).toBe(1);
  });
  it("does not backfill old results to invent recent momentum", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      row({
        matchId: String(i),
        ratingAfter: i < 10 ? 3 : null,
        ratingChange: i < 10 ? 0.02 : null,
      })
    );
    expect(computeMomentum(rows)).toBeNull();
    expect(computeMomentum(rows.slice(0, 10))).toMatchObject({
      state: "rising",
      count: 10,
      lastDate: "2026-10-05",
    });
  });
  it.each([1, -1])(
    "keeps the exact momentum boundary steady despite floating-point sums (direction %s)",
    (direction) => {
      const changes = [
        0.01, -0.01, -0.01, -0.01, 0, 0.01, -0.02, 0.02, 0.02, 0.02,
      ];
      const rows = changes.map((change, i) =>
        row({
          matchId: String(i),
          ratingChange: direction * change,
        })
      );
      expect(computeMomentum(rows)?.net).toBeCloseTo(direction * 0.03, 12);
      expect(computeMomentum(rows)?.state).toBe("steady");
      rows[9].ratingChange! += direction * 0.001;
      expect(computeMomentum(rows)?.state).toBe(
        direction === 1 ? "rising" : "recalibrating"
      );
    }
  );
  it("retains the true peak and its first achieved date, separate from the headline rating", () => {
    const result = buildPlayerPulse(
      [
        row({ matchId: "first", matchDate: "2026-08-01", ratingAfter: 4.1 }),
        row({ matchId: "second", ratingAfter: 3.8 }),
      ],
      { currentRating: 3.85 },
      now
    );
    expect(result.currentRating).toBe(3.85);
    expect(result.personalBest).toMatchObject({
      rating: 4.1,
      date: "2026-08-01",
      isCurrent: false,
    });
  });
  it("renders honest empty analytics without borrowing all-game aggregates", () => {
    const result = build([]);
    expect(result.matchCount).toBe(0);
    expect(result.currentRating).toBeNull();
    expect(summarizePulseMatches(result.matches).winRate).toBeNull();
  });
  it("does not declare a personal best just because different values round to the same headline", () => {
    const result = buildPlayerPulse(
      [row({ ratingAfter: 3.174 })],
      { currentRating: 3.171 },
      now
    );
    expect(result.personalBest?.isCurrent).toBe(false);
  });
});
