import { describe, it, expect } from "vitest";
import {
  evaluateEligibility,
  DEFAULT_ELIGIBILITY,
  type LeagueSkillEligibility,
  type PlayerSkillForEligibility,
} from "./eligibility";

const cfg = (over: Partial<LeagueSkillEligibility> = {}): LeagueSkillEligibility => ({
  ...DEFAULT_ELIGIBILITY,
  enabled: true,
  minLevel: 3.0,
  maxLevel: 3.5,
  acceptedSources: ["self"],
  minConfidence: 50,
  ...over,
});

const player = (over: Partial<PlayerSkillForEligibility> = {}): PlayerSkillForEligibility => ({
  level: 3.2,
  confidence: 65,
  provisional: false,
  source: "self",
  ...over,
});

describe("league eligibility engine", () => {
  it("is a no-op when the config is disabled (foundation off)", () => {
    const r = evaluateEligibility(DEFAULT_ELIGIBILITY, player({ level: null }));
    expect(r.eligible).toBe(true);
    expect(r.status).toBe("config_disabled");
  });

  it("accepts a player within the range with sufficient confidence", () => {
    const r = evaluateEligibility(cfg(), player());
    expect(r).toMatchObject({ eligible: true, status: "eligible", needsApproval: false });
  });

  it("flags no assessment (approvable when organizer approval is allowed)", () => {
    const r = evaluateEligibility(cfg(), player({ level: null, source: null }));
    expect(r.eligible).toBe(false);
    expect(r.status).toBe("no_assessment");
    expect(r.needsApproval).toBe(true);
    const strict = evaluateEligibility(cfg({ allowOrganizerApproval: false }), player({ level: null, source: null }));
    expect(strict.needsApproval).toBe(false);
  });

  it("rejects an unaccepted source and honors accept_self_assessment", () => {
    expect(evaluateEligibility(cfg({ acceptedSources: ["observed"] }), player()).status).toBe("source_not_accepted");
    expect(evaluateEligibility(cfg({ acceptSelfAssessment: false }), player({ source: "self" })).status).toBe("source_not_accepted");
    expect(evaluateEligibility(cfg({ acceptedSources: ["self", "observed"] }), player({ source: "observed" })).status).toBe("eligible");
  });

  it("rejects below the minimum confidence", () => {
    const r = evaluateEligibility(cfg({ minConfidence: 70 }), player({ confidence: 60 }));
    expect(r.status).toBe("low_confidence");
    expect(r.eligible).toBe(false);
  });

  it("applies the provisional policy", () => {
    expect(evaluateEligibility(cfg({ provisionalPolicy: "allow" }), player({ provisional: true })).eligible).toBe(true);
    expect(evaluateEligibility(cfg({ provisionalPolicy: "block" }), player({ provisional: true })).eligible).toBe(false);
    const rev = evaluateEligibility(cfg({ provisionalPolicy: "require_review" }), player({ provisional: true }));
    expect(rev).toMatchObject({ eligible: false, status: "provisional_blocked", needsApproval: true });
  });

  it("handles playing up (below min)", () => {
    const up = evaluateEligibility(cfg({ allowPlayingUp: true }), player({ level: 2.5 }));
    expect(up).toMatchObject({ eligible: false, status: "below_min", needsApproval: true });
    const noUp = evaluateEligibility(cfg({ allowPlayingUp: false }), player({ level: 2.5 }));
    expect(noUp).toMatchObject({ eligible: false, status: "below_min", needsApproval: false });
  });

  it("handles playing down (above max)", () => {
    const down = evaluateEligibility(cfg({ allowPlayingDown: true }), player({ level: 4.0 }));
    expect(down).toMatchObject({ eligible: true, status: "above_max" });
    const noDown = evaluateEligibility(cfg({ allowPlayingDown: false }), player({ level: 4.0 }));
    expect(noDown).toMatchObject({ eligible: false, status: "above_max" });
  });

  it("is deterministic", () => {
    const a = evaluateEligibility(cfg(), player());
    const b = evaluateEligibility(cfg(), player());
    expect(a).toEqual(b);
  });
});
