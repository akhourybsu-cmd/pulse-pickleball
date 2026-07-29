import { describe, it, expect } from "vitest";
import {
  scoreSubstituteFit,
  rankSubstitutes,
  fitTierLabel,
  PREFERRED_BAND,
  ACCEPTABLE_BAND,
  type AbsentPlayerSkill,
  type CandidateSkill,
} from "./substituteMatching";
import { DEFAULT_ELIGIBILITY } from "./eligibility";

const absent = (over: Partial<AbsentPlayerSkill> = {}): AbsentPlayerSkill => ({
  level: 3.5,
  primaryStyle: "kitchen_controller",
  secondaryStyle: null,
  preferredSide: "right",
  ...over,
});

const cand = (over: Partial<CandidateSkill> = {}): CandidateSkill => ({
  level: 3.5,
  confidence: 70,
  provisional: false,
  primaryStyle: "kitchen_controller",
  secondaryStyle: null,
  preferredSide: "right",
  active: true,
  ...over,
});

describe("substitute matching — scoreSubstituteFit", () => {
  it("gives an exact match a top-tier score", () => {
    const fit = scoreSubstituteFit(absent(), cand());
    expect(fit.tier).toBe("great");
    expect(fit.score).toBeGreaterThan(0.9);
    expect(fit.hasData).toBe(true);
    expect(fit.levelDelta).toBe(0);
    expect(fit.withinPreferredBand).toBe(true);
  });

  it("prefers the closest level (spec: 3.5 → prioritise ~3.25–3.75)", () => {
    const close = scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 3.6 }));
    const mid = scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 4.0 }));
    const far = scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 5.0 }));
    expect(close.score).toBeGreaterThan(mid.score);
    expect(mid.score).toBeGreaterThan(far.score);
    expect(close.withinPreferredBand).toBe(true);
    // 3.75 sits exactly on the preferred-band edge.
    expect(scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 3.75 })).withinPreferredBand).toBe(true);
    expect(scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 3.9 })).withinPreferredBand).toBe(false);
  });

  it("never rejects anyone — even a far level stays scored and selectable", () => {
    const far = scoreSubstituteFit(absent({ level: 3.5 }), cand({ level: 6.0 }));
    expect(far.score).toBeGreaterThanOrEqual(0); // finite, usable
    expect(far.tier).toBe("stretch");
    expect(far.hasData).toBe(true);
    expect(far.reasons.some((r) => /higher/.test(r))).toBe(true);
  });

  it("degrades gracefully when a level is missing (unknown, not rejected)", () => {
    const noCand = scoreSubstituteFit(absent(), cand({ level: null }));
    expect(noCand.tier).toBe("unknown");
    expect(noCand.hasData).toBe(false);
    expect(noCand.levelDelta).toBe(null);
    expect(noCand.reasons).toContain("No self-assessed level yet");
    const noAbsent = scoreSubstituteFit(absent({ level: null }), cand());
    expect(noAbsent.hasData).toBe(false);
  });

  it("uses style, side and confidence to break ties (all sub-dominant to level)", () => {
    const base = absent({ level: 3.5, primaryStyle: "kitchen_controller", preferredSide: "right" });
    const perfect = scoreSubstituteFit(base, cand({ level: 3.5, primaryStyle: "kitchen_controller", preferredSide: "right" }));
    const styleMiss = scoreSubstituteFit(base, cand({ level: 3.5, primaryStyle: "aggressive_driver", preferredSide: "right" }));
    const sideMiss = scoreSubstituteFit(base, cand({ level: 3.5, primaryStyle: "kitchen_controller", preferredSide: "left" }));
    expect(perfect.score).toBeGreaterThan(styleMiss.score);
    expect(perfect.score).toBeGreaterThan(sideMiss.score);
    // A same-level style/side miss must still beat a level that's a full point off.
    const levelMiss = scoreSubstituteFit(base, cand({ level: 4.5, primaryStyle: "kitchen_controller", preferredSide: "right" }));
    expect(styleMiss.score).toBeGreaterThan(levelMiss.score);
    expect(sideMiss.score).toBeGreaterThan(levelMiss.score);
  });

  it("treats unknown style/side as neutral, not a penalty", () => {
    const known = scoreSubstituteFit(absent(), cand({ primaryStyle: "aggressive_driver", preferredSide: "left" }));
    const unknown = scoreSubstituteFit(absent(), cand({ primaryStyle: null, preferredSide: null }));
    // Missing data shouldn't rank a player below a confirmed mismatch.
    expect(unknown.score).toBeGreaterThan(known.score);
  });

  it("flags provisional / benched / low-confidence without rejecting", () => {
    const prov = scoreSubstituteFit(absent(), cand({ provisional: true }));
    expect(prov.reasons).toContain("Provisional profile");
    const benched = scoreSubstituteFit(absent(), cand({ active: false }));
    expect(benched.reasons).toContain("Currently benched");
    const lowConf = scoreSubstituteFit(absent(), cand({ confidence: 40 }));
    expect(lowConf.reasons).toContain("Low assessment confidence");
    // All still carry a real, positive score.
    for (const f of [prov, benched, lowConf]) expect(f.score).toBeGreaterThan(0);
  });

  it("attaches an advisory eligibility verdict only when config is enabled", () => {
    const off = scoreSubstituteFit(absent(), cand(), { eligibility: DEFAULT_ELIGIBILITY });
    expect(off.eligibility).toBeUndefined(); // disabled config ⇒ not attached
    const on = scoreSubstituteFit(absent(), cand({ level: 5.5 }), {
      eligibility: { ...DEFAULT_ELIGIBILITY, enabled: true, minLevel: 3.0, maxLevel: 3.5, allowPlayingDown: false },
    });
    expect(on.eligibility).toBeDefined();
    expect(on.eligibility!.eligible).toBe(false); // advisory only — still scored & selectable
    expect(on.score).toBeGreaterThan(0);
  });

  it("is deterministic", () => {
    const a = scoreSubstituteFit(absent(), cand({ level: 3.7 }));
    const b = scoreSubstituteFit(absent(), cand({ level: 3.7 }));
    expect(a).toEqual(b);
  });

  it("exposes readable tier labels and sane band constants", () => {
    expect(fitTierLabel("great")).toMatch(/match/i);
    expect(fitTierLabel("unknown")).toMatch(/unknown/i);
    expect(PREFERRED_BAND).toBeLessThan(ACCEPTABLE_BAND);
  });
});

describe("substitute matching — rankSubstitutes", () => {
  const mk = (id: string, over: Partial<CandidateSkill>) => ({ id, skill: cand(over), value: id });

  it("orders best-fit first and keeps every candidate", () => {
    const ranked = rankSubstitutes(absent({ level: 3.5 }), [
      mk("far", { level: 5.0 }),
      mk("exact", { level: 3.5 }),
      mk("close", { level: 3.7 }),
    ]);
    expect(ranked.map((r) => r.candidate)).toEqual(["exact", "close", "far"]);
    expect(ranked).toHaveLength(3); // nobody dropped
  });

  it("is a stable sort — equal scores keep input order (e.g. alphabetical)", () => {
    const ranked = rankSubstitutes(absent({ level: 3.5 }), [
      mk("Ana", { level: 3.5 }),
      mk("Bo", { level: 3.5 }),
      mk("Cy", { level: 3.5 }),
    ]);
    expect(ranked.map((r) => r.candidate)).toEqual(["Ana", "Bo", "Cy"]);
  });

  it("ranks candidates without levels last but still includes them", () => {
    const ranked = rankSubstitutes(absent({ level: 3.5 }), [
      mk("noLevel", { level: null }),
      mk("good", { level: 3.6 }),
    ]);
    expect(ranked[0].candidate).toBe("good");
    expect(ranked.map((r) => r.candidate)).toContain("noLevel");
  });
});
