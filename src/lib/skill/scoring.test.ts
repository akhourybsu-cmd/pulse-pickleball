import { describe, it, expect } from "vitest";
import {
  scoreAssessment,
  confidenceLabel,
  type Responses,
} from "./scoring";
import { QUESTION_BANK_V1 } from "./questionBank";
import {
  SELF_ASSESSMENT_CAP,
  SUBSKILLS,
  bandForLevel,
  displayLevel,
  type AssessmentItem,
  type ResponseKey,
} from "./model";

/* ---- tiny synthetic-item helper for isolated mechanics ---- */
let seq = 0;
function mk(partial: Partial<AssessmentItem> & { anchorLevel: AssessmentItem["anchorLevel"] }): AssessmentItem {
  seq += 1;
  return {
    itemKey: partial.itemKey ?? `it_${seq}`,
    version: 1,
    text: partial.text ?? "observable behavior",
    domain: partial.domain ?? "serve_return",
    subskill: partial.subskill ?? "serve",
    dimension: partial.dimension ?? "execution",
    anchorLevel: partial.anchorLevel,
    weight: partial.weight ?? 1,
    isEssential: partial.isEssential ?? false,
    contradictionGroup: partial.contradictionGroup ?? null,
    prerequisite: null,
    adaptive: null,
    phase: partial.phase ?? "foundation",
    order: seq,
    active: partial.active ?? true,
  };
}

/** Answer every item in a bank with the same response. */
function answerAll(bank: readonly AssessmentItem[], r: ResponseKey): Responses {
  return Object.fromEntries(bank.map((i) => [i.itemKey, r]));
}

describe("levels & bands", () => {
  it("rounds display to one decimal and never shows misleading precision", () => {
    expect(displayLevel(3.437)).toBe(3.4);
    expect(displayLevel(3.25)).toBe(3.3); // half-up
    expect(displayLevel(2.04)).toBe(2.0);
  });
  it("maps raw levels to the correct descriptive band", () => {
    expect(bandForLevel(1.6).label).toBe("New Player");
    expect(bandForLevel(2.2).label).toBe("Beginner");
    expect(bandForLevel(2.7).label).toBe("Advanced Beginner");
    expect(bandForLevel(3.1).label).toBe("Low Intermediate");
    expect(bandForLevel(3.3).label).toBe("Intermediate");
    expect(bandForLevel(3.7).label).toBe("High Intermediate");
    expect(bandForLevel(4.2).label).toBe("Advanced");
    expect(bandForLevel(4.6).label).toBe("Expert");
  });
  it("clamps to the self-assessment cap", () => {
    expect(bandForLevel(9).label).toBe("Expert");
    expect(displayLevel(9)).toBe(SELF_ASSESSMENT_CAP);
  });
});

describe("candidate-level passing + interpolation", () => {
  const bank = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5].map((a) =>
    mk({ anchorLevel: a as AssessmentItem["anchorLevel"], itemKey: `sv_${a}` }),
  );

  it("all 'reliably' pushes to (and is capped at) the ceiling", () => {
    const snap = scoreAssessment(bank, answerAll(bank, "reliably"));
    expect(snap.estimatedLevelRaw).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
    expect(snap.estimatedLevelRaw).toBeGreaterThan(4.4);
  });

  it("all 'not yet' stays at the New Player floor", () => {
    const snap = scoreAssessment(bank, answerAll(bank, "not_yet"));
    expect(snap.estimatedLevelRaw).toBeLessThan(2.0);
    expect(snap.meta.highestPassedAnchor).toBeNull();
  });

  it("interpolates between anchors for a mid response", () => {
    // 'sometimes' (0.60) sits below the 0.72 pass line → no anchor passes,
    // but progress interpolates above the 1.5 floor.
    const snap = scoreAssessment(bank, answerAll(bank, "sometimes"));
    expect(snap.estimatedLevelRaw).toBeGreaterThan(1.5);
    expect(snap.estimatedLevelRaw).toBeLessThan(2.5);
  });
});

describe("response handling", () => {
  const bank = [2.0, 2.5, 3.0].map((a) => mk({ anchorLevel: a as AssessmentItem["anchorLevel"], itemKey: `k_${a}` }));

  it("'not sure' is excluded from mastery but still counted", () => {
    const withNotSure: Responses = { ...answerAll(bank, "reliably"), k_3: "not_sure" };
    const snap = scoreAssessment(bank, withNotSure);
    expect(snap.meta.notSureCount).toBe(1);
    expect(snap.meta.scoredCount).toBe(2);
  });

  it("'not sure' answers lower confidence versus fully-scored (full bank)", () => {
    const allSure = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "reliably"));
    const resp = answerAll(QUESTION_BANK_V1, "reliably");
    for (const it of QUESTION_BANK_V1.slice(0, 12)) resp[it.itemKey] = "not_sure";
    const snap = scoreAssessment(QUESTION_BANK_V1, resp);
    expect(snap.meta.notSureCount).toBe(12);
    expect(snap.confidence.total).toBeLessThan(allSure.confidence.total);
  });

  it("unanswered items simply don't count", () => {
    const snap = scoreAssessment(bank, { k_2: "reliably" } as Responses);
    expect(snap.meta.answeredCount).toBe(1);
  });
});

describe("essential-skill floors block compensation", () => {
  it("a severe essential weakness caps the overall level despite power strengths", () => {
    // Everything 'reliably' except the essential subskill 'dinking' at 'not yet'.
    const responses: Responses = answerAll(QUESTION_BANK_V1, "reliably");
    for (const it of QUESTION_BANK_V1) if (it.subskill === "dinking") responses[it.itemKey] = "not_yet";
    const snap = scoreAssessment(QUESTION_BANK_V1, responses);
    const unblocked = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "reliably"));
    // Held far below the otherwise-maxed result — the weakness can't be bought off.
    expect(snap.estimatedLevelRaw).toBeLessThan(3.5);
    expect(snap.estimatedLevelRaw).toBeLessThan(unblocked.estimatedLevelRaw - 1.0);
  });
});

describe("4.7 self-assessment cap", () => {
  it("a maxed-out full assessment never exceeds 4.7", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "reliably"));
    expect(snap.estimatedLevelRaw).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
    expect(snap.estimatedLevelDisplay).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
    expect(snap.upperBound).toBeLessThanOrEqual(SELF_ASSESSMENT_CAP);
  });
});

describe("confidence model", () => {
  it("never exceeds 70 without external corroboration", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "reliably"));
    expect(snap.confidence.total).toBeLessThanOrEqual(70);
  });
  it("can exceed 70 once external corroboration is present", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "reliably"), {
      externalCorroboration: 30,
      recentActivityDays: 5,
      recentMatchCount: 12,
    });
    expect(snap.confidence.total).toBeGreaterThan(70);
  });
  it("labels bands correctly", () => {
    expect(confidenceLabel(30)).toBe("Low confidence");
    expect(confidenceLabel(50)).toBe("Developing confidence");
    expect(confidenceLabel(65)).toBe("Moderate confidence");
    expect(confidenceLabel(80)).toBe("High confidence");
    expect(confidenceLabel(95)).toBe("Confirmed profile");
  });
});

describe("contradictions", () => {
  it("flags an advanced claim contradicting a weak foundation and lowers consistency", () => {
    const group = "grp";
    const bank = [
      mk({ itemKey: "hi", anchorLevel: 4.0, contradictionGroup: group }),
      mk({ itemKey: "lo", anchorLevel: 3.0, contradictionGroup: group }),
    ];
    const clean = scoreAssessment(bank, { hi: "reliably", lo: "reliably" });
    const conflicted = scoreAssessment(bank, { hi: "reliably", lo: "occasionally" });
    expect(conflicted.contradictions.length).toBeGreaterThan(0);
    expect(conflicted.confidence.internalConsistency).toBeLessThan(clean.confidence.internalConsistency);
  });
});

describe("insufficient-evidence suppression", () => {
  it("labels a subskill with fewer than 2 answers as insufficient", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, { sv_legal: "reliably" });
    const serve = snap.subskills.find((s) => s.subskill === "serve")!;
    // one answer for serve
    expect(serve.evidenceCount).toBe(1);
    expect(serve.insufficientEvidence).toBe(true);
  });
  it("exposes a score for every one of the 16 subskills", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "usually"));
    expect(snap.subskills.map((s) => s.subskill).sort()).toEqual([...SUBSKILLS].sort());
  });
});

describe("styles, strengths & priorities are traceable", () => {
  it("produces display levels to one decimal on every subskill", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "usually"));
    for (const s of snap.subskills) {
      expect(Number.isInteger(s.displayLevel * 10)).toBe(true);
    }
  });
  it("every strength & priority references real scoring evidence", () => {
    const snap = scoreAssessment(QUESTION_BANK_V1, answerAll(QUESTION_BANK_V1, "usually"));
    for (const s of [...snap.strengths, ...snap.developmentPriorities]) {
      expect(s.reason.length).toBeGreaterThan(10);
      expect(SUBSKILLS.includes(s.subskill)).toBe(true);
    }
  });
});
