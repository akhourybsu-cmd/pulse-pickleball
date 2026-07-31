import { describe, it, expect } from "vitest";
import {
  isRestoreSettled,
  isRestoreExhausted,
  shouldStopRestore,
  RESTORE_MAX_ATTEMPTS,
  RESTORE_MAX_ELAPSED_MS,
} from "./scrollRestore";

describe("scrollRestore — termination bounds", () => {
  it("settles within tolerance", () => {
    expect(isRestoreSettled(500, 500)).toBe(true);
    expect(isRestoreSettled(501, 500)).toBe(true); // 1px within 2px tolerance
    expect(isRestoreSettled(510, 500)).toBe(false);
  });

  it("exhausts on attempt cap OR time cap", () => {
    expect(isRestoreExhausted(RESTORE_MAX_ATTEMPTS, 0)).toBe(true);
    expect(isRestoreExhausted(0, RESTORE_MAX_ELAPSED_MS)).toBe(true);
    expect(isRestoreExhausted(3, 50)).toBe(false);
  });

  it("stops when settled even if attempts remain", () => {
    expect(shouldStopRestore({ attempts: 1, elapsedMs: 10, currentY: 500, targetY: 500 })).toBe(true);
  });

  it("keeps going while unsettled and within both caps", () => {
    expect(shouldStopRestore({ attempts: 2, elapsedMs: 30, currentY: 100, targetY: 500 })).toBe(false);
  });

  it("ALWAYS terminates — a target taller than the reachable page can't spin forever", () => {
    // Simulate the loop against a document that can only ever reach y=200 when
    // we asked for 900. It must stop at the attempt cap.
    const target = 900;
    const reachable = 200;
    let attempts = 0;
    let stopped = false;
    for (let frame = 0; frame < 1000; frame++) {
      attempts += 1;
      if (
        shouldStopRestore({
          attempts,
          elapsedMs: attempts, // 1ms/frame — attempt cap trips first
          currentY: reachable,
          targetY: target,
        })
      ) {
        stopped = true;
        break;
      }
    }
    expect(stopped).toBe(true);
    expect(attempts).toBe(RESTORE_MAX_ATTEMPTS);
  });

  it("terminates via the time cutoff even if frames are cheap", () => {
    let attempts = 0;
    let stopped = false;
    for (let frame = 0; frame < 100000; frame++) {
      attempts += 1;
      if (
        shouldStopRestore({
          attempts: 1, // never trips the attempt cap
          elapsedMs: frame * 25, // ~25ms/frame → time cap trips
          currentY: 0,
          targetY: 900,
        })
      ) {
        stopped = true;
        break;
      }
    }
    expect(stopped).toBe(true);
  });
});
