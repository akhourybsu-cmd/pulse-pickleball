import { describe, expect, it } from "vitest";
import { roundRobinEditError, substitutionIssue } from "./editGuidance";

const match = { id:"match", round_no:2, court_no:1, a1_player_id:"out", a2_player_id:"partner", b1_guest_id:"guest", b2_player_id:"opponent", is_bye:false, team1_score:null, team2_score:null };
const input = { schedule:[match], status:"live", currentRound:2, scope:2, original:{playerId:"out"}, replacement:{playerId:"new"} };
describe("live replacement guidance", () => {
  it("permits an unassigned new arrival or resting guest", () => {
    expect(substitutionIssue(input)).toBeNull();
    expect(substitutionIssue({...input,replacement:{guestPlayerId:"resting"},schedule:[match,{id:"rest",round_no:2,court_no:0,is_bye:true,a1_guest_id:"resting"}]})).toBeNull();
  });
  it("blocks double-booking a registered player or guest", () => {
    expect(substitutionIssue({...input,replacement:{playerId:"partner"}})).toContain("already on court");
    expect(substitutionIssue({...input,replacement:{guestPlayerId:"guest"}})).toContain("already on court");
  });
  it.each([{team1_score:0},{team2_score:1},{locked_at:"now"},{match_id:"history"},{abandoned:true}])("preserves a protected current match: %s", protection => {
    expect(substitutionIssue({...input,schedule:[{...match,...protection}]})).toContain("Future rounds only");
    expect(substitutionIssue({...input,scope:"global",schedule:[{...match,...protection}]})).toBeNull();
  });
  it("rejects a changed live round without widening the replacement scope", () => {
    expect(substitutionIssue({...input,currentRound:3})).toContain("live round changed");
    expect(substitutionIssue({...input,status:"draft",scope:"current_future"})).toContain("live round changed");
  });
  it("requires exactly one canonical outgoing court assignment", () => {
    expect(substitutionIssue({...input,schedule:[{...match,is_bye:true}]})).toContain("one current court");
    expect(substitutionIssue({...input,schedule:[match,{...match,id:"duplicate"}]})).toContain("one current court");
    expect(substitutionIssue({...input,schedule:[match,{...match,id:"old",voided_at:"now"}]})).toBeNull();
  });
  it("rejects self-replacement and closed events", () => {
    expect(substitutionIssue({...input,replacement:{playerId:"out"}})).toContain("different player");
    expect(substitutionIssue({...input,status:"completed"})).toContain("event is closed");
  });
});
describe("actionable editing failures", () => {
  it("preserves the planner code when equal games fail", () => {
    expect(roundRobinEditError({message:"Cannot build this plan",code:"equal_games_unavailable"})).toContain("Allow balanced games");
  });
  it("explains how to recover an insufficient roster", () => {
    const message = roundRobinEditError({message:"Cannot build this plan",code:"insufficient_players"});
    expect(message).toContain("four eligible players");
    expect(message).toContain("replacement instead of a removal");
  });
  it("explains missing format eligibility without exposing the planner code", () => {
    const message = roundRobinEditError({message:"Cannot build this plan",code:"mixed_roster_gender_missing"});
    expect(message).toContain("two men and two women");
    expect(message).not.toContain("mixed_roster_gender_missing");
  });
  it("gives a recovery path for stale and protected edits", () => {
    expect(roundRobinEditError({message:"RR_STALE_VERSION",code:"40001"})).toContain("Review latest");
    expect(roundRobinEditError(new Error("RR_PROTECTED_ROUND:locked"))).toContain("Manage scores");
  });
  it("never promises rollback when a network response is lost", () => {
    const message = roundRobinEditError(new Error("Failed to fetch"));
    expect(message).toContain("check whether it already saved");
    expect(message).not.toContain("Nothing changed");
  });
  it("hides database internals and directs hosts to check the saved state", () => {
    expect(roundRobinEditError(new Error('relation "private_table" does not exist'))).not.toContain("private_table");
  });
});
