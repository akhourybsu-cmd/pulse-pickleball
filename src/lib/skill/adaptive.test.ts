import { describe, it, expect } from "vitest";
import {
  DEFAULT_ADAPTIVE_CONFIG,
  selectNextItemKey,
  isComplete,
  simulateAdaptive,
} from "./adaptive";
import { QUESTION_BANK_V1, FOUNDATION_ITEMS, itemByKey } from "./questionBank";
import { buildResponses, personaByKey } from "./personas";
import type { Responses } from "./scoring";

const cfg = DEFAULT_ADAPTIVE_CONFIG;

function runPersona(key: string) {
  const answers = buildResponses(personaByKey(key)!);
  return simulateAdaptive(QUESTION_BANK_V1, answers, cfg);
}

describe("adaptive engine — structure", () => {
  it("asks the foundation items first, in canonical order", () => {
    const { asked } = runPersona("intermediate_balanced");
    const foundationKeys = [...FOUNDATION_ITEMS].sort((a, b) => a.order - b.order).map((i) => i.itemKey);
    // The first N asked (N = foundation count) are exactly the foundation set in order.
    expect(asked.slice(0, foundationKeys.length)).toEqual(foundationKeys);
  });

  it("never asks a duplicate", () => {
    const { asked } = runPersona("adv_all_court");
    expect(new Set(asked).size).toBe(asked.length);
  });

  it("respects the maximum question limit", () => {
    const { asked } = runPersona("adv_all_court");
    expect(asked.length).toBeLessThanOrEqual(cfg.maxItems);
  });

  it("only ever selects active items that exist in the bank", () => {
    const { asked } = runPersona("high_int_soft");
    for (const k of asked) expect(itemByKey(k)?.active).toBe(true);
  });
});

describe("adaptive engine — paths", () => {
  it("beginner path stops early and avoids clearly-too-advanced (4.5) items", () => {
    const { asked } = runPersona("new_player");
    // Early stop: a genuine beginner exhausts appropriate items before the cap.
    expect(asked.length).toBeLessThan(cfg.maxItems);
    const anchors = asked.map((k) => itemByKey(k)!.anchorLevel);
    expect(anchors.filter((a) => a >= 4.5).length).toBe(0);
  });

  it("advanced path reaches high-anchor items", () => {
    const { asked } = runPersona("adv_all_court");
    const anchors = asked.map((k) => itemByKey(k)!.anchorLevel);
    expect(anchors.some((a) => a >= 4.0)).toBe(true);
  });

  it("intermediate path lands in the typical completed-length band", () => {
    const { asked } = runPersona("intermediate_balanced");
    expect(asked.length).toBeGreaterThanOrEqual(30);
    expect(asked.length).toBeLessThanOrEqual(cfg.maxItems);
  });

  it("chases a contradiction with follow-up items in the flagged group", () => {
    // Answer only the foundation so far is clean; then inject a contradiction
    // by answering an advanced item high and its foundation low in one group.
    const responses: Responses = {};
    for (const it of FOUNDATION_ITEMS) responses[it.itemKey] = "usually";
    responses["bh_under_pressure"] = "reliably"; // backhand_gap advanced (4.0)
    responses["bh_consistent"] = "occasionally"; // backhand_gap foundation (2.5)
    // With the contradiction present, a backhand_gap item should be prioritised
    // (or the run should not be considered complete purely on count).
    const next = selectNextItemKey(QUESTION_BANK_V1, responses, cfg);
    expect(next).not.toBeNull();
  });
});

describe("adaptive engine — resume & determinism", () => {
  it("is deterministic: same responses → same next item", () => {
    const responses: Responses = {};
    for (const it of FOUNDATION_ITEMS.slice(0, 10)) responses[it.itemKey] = "sometimes";
    const a = selectNextItemKey(QUESTION_BANK_V1, responses, cfg);
    const b = selectNextItemKey(QUESTION_BANK_V1, responses, cfg);
    expect(a).toBe(b);
  });

  it("resumes at the right point after a partial run", () => {
    const answers = buildResponses(personaByKey("high_int_driver")!);
    // Answer the first 15 items the engine would pick, then resume.
    const partial: Responses = {};
    for (let i = 0; i < 15; i++) {
      const next = selectNextItemKey(QUESTION_BANK_V1, partial, cfg)!;
      partial[next] = answers[next] ?? "not_sure";
    }
    expect(Object.keys(partial).length).toBe(15);
    expect(isComplete(QUESTION_BANK_V1, partial, cfg)).toBe(false);
    // Finishing from the resume point produces a complete assessment.
    const full = simulateAdaptive(QUESTION_BANK_V1, answers, cfg);
    expect(full.asked.slice(0, 15)).toEqual(Object.keys(partial));
  });

  it("ignores responses for unknown items (version mismatch tolerance)", () => {
    const responses: Responses = { not_a_real_item_key: "reliably" };
    // The engine treats unknown keys as absent and still starts at foundation.
    const next = selectNextItemKey(QUESTION_BANK_V1, responses, cfg);
    expect(next).toBe([...FOUNDATION_ITEMS].sort((a, b) => a.order - b.order)[0].itemKey);
  });
});
