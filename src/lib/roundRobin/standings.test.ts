import { describe, it, expect } from "vitest";
import { countsTowardScore } from "./standings";

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
