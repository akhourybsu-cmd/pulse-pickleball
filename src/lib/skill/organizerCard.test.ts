import { describe, it, expect } from "vitest";
import { reviewRecommended, sanitizeForOrganizer, confidenceGuidance } from "./organizerCard";
import { scoreAssessment } from "./scoring";
import { QUESTION_BANK_V1 } from "./questionBank";
import { buildResponses, personaByKey } from "./personas";

describe("organizer card — review recommended", () => {
  it("flags low confidence", () => {
    expect(reviewRecommended({ confidence: 40 })).toBe(true);
  });
  it("flags contradictions", () => {
    expect(reviewRecommended({ confidence: 80, contradictionSeverity: 2 })).toBe(true);
  });
  it("flags provisional", () => {
    expect(reviewRecommended({ confidence: 80, provisional: true })).toBe(true);
  });
  it("does not flag a solid, settled profile", () => {
    expect(reviewRecommended({ confidence: 68, contradictionSeverity: 0, provisional: false })).toBe(false);
  });
});

describe("organizer card — sanitization (privacy)", () => {
  it("strips contradictions + internal meta but keeps placement fields", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, buildResponses(personaByKey("inflated_contradictory")!));
    expect(snap.contradictions.length).toBeGreaterThan(0); // present in the raw snapshot
    const card = sanitizeForOrganizer(snap);
    expect((card as Record<string, unknown>).contradictions).toBeUndefined();
    expect((card as Record<string, unknown>).meta).toBeUndefined();
    // …but the placement-useful fields survive.
    expect(card.estimatedLevelDisplay).toBe(snap.estimatedLevelDisplay);
    expect(card.strengths).toEqual(snap.strengths);
    expect(card.developmentPriorities).toEqual(snap.developmentPriorities);
    expect(card.domains.length).toBe(snap.domains.length);
    expect(card.subskills.length).toBe(snap.subskills.length);
  });
});

describe("organizer card — confidence guidance copy", () => {
  it("prioritises provisional, is non-accusatory, and null when solid", () => {
    expect(confidenceGuidance(true, true)).toMatch(/provisional/i);
    expect(confidenceGuidance(true, false)).toMatch(/review recommended/i);
    expect(confidenceGuidance(false, false)).toBeNull();
    // Never implies dishonesty.
    expect(confidenceGuidance(true, false)).not.toMatch(/contradict|dishonest|inflat/i);
  });
});
