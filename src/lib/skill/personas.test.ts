import { describe, it, expect } from "vitest";
import { scoreAssessment } from "./scoring";
import { QUESTION_BANK_V1 } from "./questionBank";
import { PERSONAS, buildResponses, personaByKey } from "./personas";
import { SELF_ASSESSMENT_CAP } from "./model";

function score(key: string) {
  const p = personaByKey(key)!;
  return scoreAssessment(QUESTION_BANK_V1, buildResponses(p));
}

describe("persona plausibility (results are explainable and in range)", () => {
  it("every persona stays within valid bounds and is capped at 4.7", () => {
    for (const p of PERSONAS) {
      const snap = scoreAssessment(QUESTION_BANK_V1, buildResponses(p));
      expect(snap.estimatedLevelRaw).toBeGreaterThanOrEqual(1.0);
      expect(snap.estimatedLevelRaw).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
      expect(snap.confidence.total).toBeGreaterThanOrEqual(0);
      expect(snap.confidence.total).toBeLessThanOrEqual(100);
    }
  });

  it("new player lands low", () => {
    expect(score("new_player").estimatedLevelRaw).toBeLessThan(2.3);
  });

  it("beginner sits below advanced beginner sits below intermediate", () => {
    const beg = score("beginner_inconsistent").estimatedLevelRaw;
    const advBeg = score("adv_beginner_positioning").estimatedLevelRaw;
    const inter = score("intermediate_balanced").estimatedLevelRaw;
    // Monotonic ordering with meaningful separation is what "plausible" means;
    // absolute band placement is deliberately conservative in the engine.
    expect(beg).toBeLessThan(advBeg);
    expect(advBeg).toBeLessThan(inter);
    expect(inter - beg).toBeGreaterThan(0.4);
  });

  it("advanced personas outrank intermediate ones", () => {
    const inter = score("intermediate_balanced").estimatedLevelRaw;
    const allCourt = score("adv_all_court").estimatedLevelRaw;
    const counter = score("adv_counterpuncher").estimatedLevelRaw;
    expect(allCourt).toBeGreaterThan(inter);
    expect(counter).toBeGreaterThan(inter);
  });

  it("the aggressive driver reads as a Driver style, not merely 'hits hard'", () => {
    const snap = score("high_int_driver");
    const styleKeys = [snap.primaryStyle?.key, snap.secondaryStyle?.key];
    expect(styleKeys).toContain("aggressive_driver");
    // Drive shows up as a genuine strength.
    expect(snap.strengths.some((s) => s.subskill === "drive" || s.subskill === "forehand")).toBe(true);
  });

  it("the soft-game specialist surfaces a soft-game identity and strengths", () => {
    const snap = score("high_int_soft");
    const styleKeys = [snap.primaryStyle?.key, snap.secondaryStyle?.key];
    expect(
      styleKeys.some((k) => k === "soft_game_specialist" || k === "kitchen_controller" || k === "strategic_builder"),
    ).toBe(true);
    expect(snap.strengths.some((s) => ["dinking", "dink_strategy", "third_shot_drop"].includes(s.subskill))).toBe(true);
  });

  it("the power-oriented low-intermediate is held back by weak essentials", () => {
    const snap = score("low_int_power");
    // Strong drive but weak transition/defense keeps them intermediate, not advanced.
    expect(snap.estimatedLevelRaw).toBeLessThan(3.6);
    const priorityKeys = snap.developmentPriorities.map((p) => p.subskill);
    expect(
      priorityKeys.some((k) => ["third_shot_drop", "dinking", "resets_defense", "transition_play"].includes(k)),
    ).toBe(true);
  });

  it("inflated & contradictory answers register contradictions and don't reach advanced", () => {
    const snap = score("inflated_contradictory");
    expect(snap.contradictions.length).toBeGreaterThan(0);
    expect(snap.estimatedLevelRaw).toBeLessThan(4.0);
    // Contradictions depress internal consistency.
    expect(snap.confidence.internalConsistency).toBeLessThan(20);
  });

  it("many 'not sure' answers produce low confidence but still a usable estimate", () => {
    const snap = score("many_not_sure");
    expect(snap.meta.notSureCount).toBeGreaterThan(10);
    expect(snap.confidence.total).toBeLessThan(60);
    expect(snap.estimatedLevelRaw).toBeGreaterThan(1.0);
  });

  it("the adaptive/functional player is not penalised for skipped mobility skills", () => {
    const snap = score("adaptive_functional");
    const overhead = snap.subskills.find((s) => s.subskill === "overheads_lobs")!;
    expect(overhead.insufficientEvidence).toBe(true); // all 'not sure' → suppressed, not scored 0
    // Strong functional skills still yield a solid level.
    expect(snap.estimatedLevelRaw).toBeGreaterThan(3.2);
  });

  it("results are deterministic (same input → identical snapshot)", () => {
    const a = score("intermediate_balanced");
    const b = score("intermediate_balanced");
    expect(a).toEqual(b);
  });
});
