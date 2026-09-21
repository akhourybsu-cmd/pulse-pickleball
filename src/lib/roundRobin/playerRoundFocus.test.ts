import { describe, expect, it } from "vitest";
import { playerRoundFocus } from "./playerRoundFocus";

const match = (round: number, overrides = {}) => ({
  round_no: round, court_no: 2, is_bye: false, completed: false,
  a1_player_id: "me", a2_player_id: "partner", b1_player_id: "opponent1", b2_player_id: "opponent2",
  a1_guest_id: null, a2_guest_id: null, b1_guest_id: null, b2_guest_id: null, ...overrides,
});
const ids = new Set(["me"]);

describe("playerRoundFocus", () => {
  it("keeps the host's current round even after the player's result is recorded", () => {
    const current = match(2, { completed: true });
    const next = match(3);
    expect(playerRoundFocus([next, current], ids, 2)).toMatchObject({ current, next, resting: false, onTeamA: true });
  });
  it("skips byes and completed future matches when finding the next saved assignment", () => {
    const current = match(2, { is_bye: true });
    const next = match(5);
    expect(playerRoundFocus([next, match(4, { completed: true }), match(3, { is_bye: true }), current], ids, 2))
      .toMatchObject({ current, next, resting: true });
  });
  it("recognizes legacy mirrored and empty-opponent rest rows", () => {
    expect(playerRoundFocus([match(1, { b1_player_id: "me" })], ids, 1).resting).toBe(true);
    expect(playerRoundFocus([match(1, { b1_player_id: null })], ids, 1).resting).toBe(true);
  });
  it("resolves a linked guest on team B", () => {
    const current = match(1, { a1_player_id: "another", b1_player_id: null, b1_guest_id: "guest-me" });
    expect(playerRoundFocus([current], new Set(["me", "guest-me"]), 1)).toMatchObject({ current, resting: false, onTeamA: false });
  });
  it("does not invent an assignment for an unassigned player or spectator", () => {
    expect(playerRoundFocus([], ids, 1).current).toBeUndefined();
    expect(playerRoundFocus([match(1)], new Set(), 1).current).toBeUndefined();
    expect(playerRoundFocus([match(1)], ids, 1).next).toBeUndefined();
    expect(playerRoundFocus([match(2)], ids, 1).resting).toBe(false);
  });
  it("does not reorder the saved schedule", () => {
    const schedule = [match(4), match(2), match(3)];
    playerRoundFocus(schedule, ids, 2);
    expect(schedule.map(row => row.round_no)).toEqual([4, 2, 3]);
  });
});
