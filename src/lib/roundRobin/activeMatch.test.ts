import { describe, it, expect } from "vitest";
import { findParticipantLiveMatch, type LiveMatchRow } from "./activeMatch";

/** Minimal schedule-row factory — everything null unless overridden. */
function row(partial: Partial<LiveMatchRow> & { id: string; round_no: number }): LiveMatchRow {
  return {
    court_no: 1,
    is_bye: false,
    voided_at: null,
    superseded_by_schedule_id: null,
    team1_score: null,
    team2_score: null,
    a1_player_id: null,
    a2_player_id: null,
    b1_player_id: null,
    b2_player_id: null,
    a1_guest_id: null,
    a2_guest_id: null,
    b1_guest_id: null,
    b2_guest_id: null,
    ...partial,
  };
}

describe("findParticipantLiveMatch", () => {
  it("returns null when the participant has no identity", () => {
    const schedule = [row({ id: "m1", round_no: 2, a1_player_id: "p1" })];
    expect(findParticipantLiveMatch(schedule, 2, {})).toBeNull();
    expect(findParticipantLiveMatch(schedule, 2, { playerId: null, guestPlayerId: null })).toBeNull();
  });

  it("finds a profile seated in the current round's match", () => {
    const schedule = [
      row({ id: "m0", round_no: 1, a1_player_id: "p1" }),
      row({ id: "m1", round_no: 2, court_no: 3, b2_player_id: "p1" }),
    ];
    const found = findParticipantLiveMatch(schedule, 2, { playerId: "p1" });
    expect(found?.match.id).toBe("m1");
    expect(found?.match.court_no).toBe(3);
    expect(found?.isScored).toBe(false);
  });

  it("finds a guest seated in the current round's match", () => {
    const schedule = [row({ id: "m1", round_no: 4, a2_guest_id: "g9" })];
    const found = findParticipantLiveMatch(schedule, 4, { guestPlayerId: "g9" });
    expect(found?.match.id).toBe("m1");
  });

  it("defaults currentRound to 1 when null/undefined", () => {
    const schedule = [row({ id: "m1", round_no: 1, a1_player_id: "p1" })];
    expect(findParticipantLiveMatch(schedule, null, { playerId: "p1" })?.match.id).toBe("m1");
    expect(findParticipantLiveMatch(schedule, undefined, { playerId: "p1" })?.match.id).toBe("m1");
  });

  it("ignores matches in other rounds", () => {
    const schedule = [row({ id: "m1", round_no: 1, a1_player_id: "p1" })];
    expect(findParticipantLiveMatch(schedule, 2, { playerId: "p1" })).toBeNull();
  });

  it("ignores byes even when the seat matches", () => {
    const schedule = [row({ id: "m1", round_no: 2, is_bye: true, a1_player_id: "p1" })];
    expect(findParticipantLiveMatch(schedule, 2, { playerId: "p1" })).toBeNull();
  });

  it("ignores voided and superseded rows", () => {
    const schedule = [
      row({ id: "m1", round_no: 2, a1_player_id: "p1", voided_at: "2026-01-01T00:00:00Z" }),
      row({ id: "m2", round_no: 2, a1_player_id: "p1", superseded_by_schedule_id: "m9" }),
    ];
    expect(findParticipantLiveMatch(schedule, 2, { playerId: "p1" })).toBeNull();
  });

  it("reports isScored=true only when both team scores are present", () => {
    const partial = [row({ id: "m1", round_no: 2, a1_player_id: "p1", team1_score: 11, team2_score: null })];
    expect(findParticipantLiveMatch(partial, 2, { playerId: "p1" })?.isScored).toBe(false);

    const full = [row({ id: "m2", round_no: 2, a1_player_id: "p1", team1_score: 11, team2_score: 7 })];
    expect(findParticipantLiveMatch(full, 2, { playerId: "p1" })?.isScored).toBe(true);
  });

  it("matches a seat in any of the four positions", () => {
    for (const seat of ["a1_player_id", "a2_player_id", "b1_player_id", "b2_player_id"] as const) {
      const schedule = [row({ id: "m1", round_no: 2, [seat]: "p1" })];
      expect(findParticipantLiveMatch(schedule, 2, { playerId: "p1" })?.match.id).toBe("m1");
    }
  });

  it("returns the first canonical match, skipping a superseded earlier one", () => {
    const schedule = [
      row({ id: "old", round_no: 2, a1_player_id: "p1", superseded_by_schedule_id: "new" }),
      row({ id: "new", round_no: 2, a1_player_id: "p1" }),
    ];
    expect(findParticipantLiveMatch(schedule, 2, { playerId: "p1" })?.match.id).toBe("new");
  });
});
