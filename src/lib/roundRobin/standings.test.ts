import { describe, it, expect } from "vitest";
import { countsTowardScore, computeStandings } from "./standings";

describe("countsTowardScore", () => {
  const played = { is_bye: false, team1_score: 11, team2_score: 7 };

  it("counts a normal played match", () => {
    expect(countsTowardScore(played)).toBe(true);
  });

  it("excludes byes and unscored matches", () => {
    expect(countsTowardScore({ is_bye: true, team1_score: 11, team2_score: 7 })).toBe(false);
    expect(countsTowardScore({ is_bye: false, team1_score: null, team2_score: 7 })).toBe(false);
    expect(countsTowardScore({ is_bye: false, team1_score: 11, team2_score: null })).toBe(false);
  });

  it("excludes voided, superseded, and abandoned matches", () => {
    expect(countsTowardScore({ ...played, voided_at: "2026-07-16T00:00:00Z" })).toBe(false);
    expect(countsTowardScore({ ...played, superseded_by_schedule_id: "row-2" })).toBe(false);
    expect(countsTowardScore({ ...played, abandoned: true })).toBe(false);
  });

  it("is a no-op for readers that omit the guard columns (backward compatible)", () => {
    // Only is_bye + scores provided (undefined guard fields) → behaves as before.
    expect(countsTowardScore({ is_bye: false, team1_score: 11, team2_score: 4 })).toBe(true);
  });
});

describe("computeStandings", () => {
  const seat = (a1: string, a2: string, b1: string, b2: string, s1: number, s2: number) => ({
    a1_player_id: a1, a2_player_id: a2, b1_player_id: b1, b2_player_id: b2,
    team1_score: s1, team2_score: s2,
  });

  it("ranks by wins, then diff, then points for, and pins removed players last", () => {
    const schedule = [
      seat("a", "b", "c", "d", 11, 5),
      seat("a", "c", "b", "d", 11, 9),
      seat("a", "d", "b", "c", 11, 2),
    ];
    const rows = computeStandings(schedule, [
      { key: "a", name: "A", active: true },
      { key: "b", name: "B", active: true },
      { key: "c", name: "C", active: true },
      { key: "d", name: "D", active: false },
    ]);
    expect(rows[0].key).toBe("a");
    expect(rows[0].wins).toBe(3);
    expect(rows[rows.length - 1].key).toBe("d");
    expect(rows[rows.length - 1].isRemoved).toBe(true);
  });

  it("ignores voided, bye, and unscored rows", () => {
    const rows = computeStandings(
      [
        { ...seat("a", "b", "c", "d", 11, 5), voided_at: "now" },
        { ...seat("a", "b", "c", "d", 11, 5), is_bye: true },
        seat("a", "b", "c", "d", null as any, null as any),
      ],
      [{ key: "a", name: "A" }],
    );
    expect(rows[0].gamesPlayed).toBe(0);
  });
});
