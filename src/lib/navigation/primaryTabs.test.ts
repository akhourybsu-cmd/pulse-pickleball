import { describe, it, expect } from "vitest";
import {
  PRIMARY_TABS,
  primaryTabIndex,
  primaryTabPath,
  isPrimaryTabPath,
  slideDirection,
} from "./primaryTabs";

const idx = (p: string) => primaryTabIndex(p);

describe("primaryTabs — ownership", () => {
  it("maps each tab root to its position", () => {
    expect(idx("/player/dashboard")).toBe(0);
    expect(idx("/player/matches")).toBe(1);
    expect(idx("/player/social")).toBe(2);
    expect(idx("/player/community")).toBe(3);
    expect(idx("/player/profile")).toBe(4);
  });

  it("Social owns messages + friends aliases", () => {
    expect(idx("/player/friends")).toBe(2);
    expect(idx("/player/friends?tab=requests")).toBe(-1); // query is not part of pathname
    expect(idx("/player/messages")).toBe(2);
    expect(idx("/player/messages/abc-123")).toBe(2);
  });

  it("tabs own their subtrees (segment-aware)", () => {
    expect(idx("/player/matches/new")).toBe(1);
    expect(idx("/player/community/group/g1")).toBe(3);
    expect(idx("/player/profile/edit")).toBe(4);
  });

  it("does not prefix-match across segment boundaries", () => {
    expect(idx("/player/matcheses")).toBe(-1);
    expect(idx("/player/socialite")).toBe(-1);
  });

  it("returns -1 for non-primary player routes", () => {
    for (const p of [
      "/player/leagues",
      "/player/leagues/l1/manage",
      "/player/play",
      "/player/pulse",
      "/player/round-robins",
      "/player/guests",
      "/player/my-events",
    ]) {
      expect(idx(p)).toBe(-1);
    }
  });

  it("primaryTabPath returns the owning root or null", () => {
    expect(primaryTabPath("/player/messages/x")).toBe("/player/social");
    expect(primaryTabPath("/player/community/group/g")).toBe("/player/community");
    expect(primaryTabPath("/player/leagues")).toBeNull();
  });

  it("isPrimaryTabPath predicate", () => {
    expect(isPrimaryTabPath("/player/dashboard")).toBe(true);
    expect(isPrimaryTabPath("/player/leagues")).toBe(false);
  });
});

describe("primaryTabs — slide direction (acceptance criteria)", () => {
  it("Home → Matches is forward (right)", () => {
    expect(slideDirection(idx("/player/dashboard"), idx("/player/matches"))).toBe(1);
  });

  it("Matches → Home is reverse (left)", () => {
    expect(slideDirection(idx("/player/matches"), idx("/player/dashboard"))).toBe(-1);
  });

  it("Home → Community (multi-tab skip) is forward", () => {
    expect(slideDirection(idx("/player/dashboard"), idx("/player/community"))).toBe(1);
  });

  it("Profile → Social (multi-tab skip) is reverse", () => {
    expect(slideDirection(idx("/player/profile"), idx("/player/social"))).toBe(-1);
  });

  it("tapping the active tab does not run a transition", () => {
    expect(slideDirection(idx("/player/social"), idx("/player/social"))).toBe(0);
    // Social alias → same tab, still no transition.
    expect(slideDirection(idx("/player/social"), idx("/player/messages"))).toBe(0);
  });

  it("initial load / deep-link fabricates no direction", () => {
    // prevIndex is -1 before any primary tab has been seen.
    expect(slideDirection(-1, idx("/player/community"))).toBe(0);
  });

  it("navigating from a non-primary route yields no direction", () => {
    expect(slideDirection(idx("/player/leagues"), idx("/player/matches"))).toBe(0);
  });

  it("direction is consistent across every ordered pair", () => {
    for (let a = 0; a < PRIMARY_TABS.length; a++) {
      for (let b = 0; b < PRIMARY_TABS.length; b++) {
        const d = slideDirection(a, b);
        if (a === b) expect(d).toBe(0);
        else expect(d).toBe(b > a ? 1 : -1);
      }
    }
  });
});
