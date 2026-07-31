import { describe, it, expect } from "vitest";
import {
  shellRouteKind,
  shellDepth,
  classifyTransition,
  transitionKey,
  type NavigationType,
} from "./navClassification";

const t = (prevPath: string | null, nextPath: string, navigationType: NavigationType = "PUSH") =>
  classifyTransition({ prevPath, nextPath, navigationType });

describe("navClassification — shellRouteKind", () => {
  it("classifies the five primary tab views", () => {
    expect(shellRouteKind("/player/dashboard")).toBe("primary");
    expect(shellRouteKind("/player/matches")).toBe("primary");
    expect(shellRouteKind("/player/social")).toBe("primary");
    expect(shellRouteKind("/player/friends")).toBe("primary");
    expect(shellRouteKind("/player/messages")).toBe("primary");
    expect(shellRouteKind("/player/community")).toBe("primary");
    expect(shellRouteKind("/player/profile")).toBe("primary");
  });

  it("classifies detail routes", () => {
    for (const p of [
      "/player/pulse",
      "/player/round-robins",
      "/player/guests",
      "/player/events",
      "/player/my-events",
      "/player/play",
      "/player/profile/edit",
      "/player/self-assessment",
    ]) {
      expect(shellRouteKind(p)).toBe("detail");
    }
  });

  it("defers league + community-inner to their outlets", () => {
    expect(shellRouteKind("/player/leagues")).toBe("league");
    expect(shellRouteKind("/player/leagues/l1")).toBe("league");
    expect(shellRouteKind("/player/leagues/l1/manage")).toBe("league");
    expect(shellRouteKind("/player/community/group/g1")).toBe("community-inner");
    expect(shellRouteKind("/player/community/group/g1/manage")).toBe("community-inner");
  });

  it("classifies immersive routes (DM thread, match entry)", () => {
    expect(shellRouteKind("/player/messages/abc")).toBe("immersive");
    expect(shellRouteKind("/player/matches/new")).toBe("immersive");
  });

  it("does not treat a longer URL as automatically deeper", () => {
    // /player/matches (primary, depth 0) vs /player/matches/new (immersive) —
    // the deeper URL is NOT a 'detail' push, it's immersive.
    expect(shellDepth("/player/matches")).toBe(0);
    expect(shellRouteKind("/player/matches/new")).toBe("immersive");
    // A detail page and a primary view have explicit depths, not string length.
    expect(shellDepth("/player/pulse")).toBe(1);
    expect(shellDepth("/player/dashboard")).toBe(0);
  });
});

describe("navClassification — transitions (acceptance criteria)", () => {
  it("1. primary tab → detail is detail-forward", () => {
    expect(t("/player/profile", "/player/pulse")).toEqual({ kind: "detail-forward", direction: 1 });
    expect(t("/player/profile", "/player/profile/edit")).toEqual({ kind: "detail-forward", direction: 1 });
  });

  it("2. detail → parent through POP is detail-back", () => {
    expect(t("/player/pulse", "/player/profile", "POP")).toEqual({ kind: "detail-back", direction: -1 });
  });

  it("3. primary → primary stays a primary-tab (lateral) transition", () => {
    expect(t("/player/dashboard", "/player/matches")).toEqual({ kind: "primary-tab", direction: 1 });
    expect(t("/player/profile", "/player/social")).toEqual({ kind: "primary-tab", direction: -1 });
  });

  it("4. query-only navigation triggers no push", () => {
    expect(t("/player/matches", "/player/matches")).toEqual({ kind: "none", direction: 0 });
  });

  it("5. replace navigation fabricates no forward motion", () => {
    expect(t("/player/profile", "/player/pulse", "REPLACE")).toEqual({ kind: "none", direction: 0 });
  });

  it("6. initial deep-link has no fabricated transition", () => {
    expect(t(null, "/player/pulse")).toEqual({ kind: "none", direction: 0 });
    expect(t(null, "/player/matches")).toEqual({ kind: "none", direction: 0 });
  });

  it("7 & 8. nested detail forward, then back", () => {
    // primary → detail (forward), detail → primary (back).
    expect(t("/player/dashboard", "/player/round-robins").kind).toBe("detail-forward");
    expect(t("/player/round-robins", "/player/dashboard", "POP").kind).toBe("detail-back");
  });

  it("9. immersive routes are never a shell page-push", () => {
    expect(t("/player/social", "/player/messages/abc")).toEqual({ kind: "none", direction: 0 });
    expect(t("/player/matches", "/player/matches/new")).toEqual({ kind: "none", direction: 0 });
  });

  it("10 & 11. outlet routes + redirects do not get a competing push", () => {
    expect(t("/player/matches", "/player/leagues/l1")).toEqual({ kind: "none", direction: 0 });
    expect(t("/player/community", "/player/community/group/g")).toEqual({ kind: "none", direction: 0 });
  });

  it("within-tab Social ↔ Friends is not a transition", () => {
    expect(t("/player/social", "/player/friends")).toEqual({ kind: "none", direction: 0 });
    expect(t("/player/friends", "/player/messages")).toEqual({ kind: "none", direction: 0 });
  });

  it("coming from an outlet route into a tab fabricates no motion", () => {
    expect(t("/player/leagues/l1", "/player/matches", "POP")).toEqual({ kind: "none", direction: 0 });
  });

  it("multi-tab skip keeps a single directional lateral slide", () => {
    expect(t("/player/dashboard", "/player/community")).toEqual({ kind: "primary-tab", direction: 1 });
    expect(t("/player/community", "/player/dashboard")).toEqual({ kind: "primary-tab", direction: -1 });
  });
});

describe("navClassification — transitionKey", () => {
  it("primary views share their tab root key", () => {
    expect(transitionKey("/player/friends")).toBe("/player/social");
    expect(transitionKey("/player/messages")).toBe("/player/social");
    expect(transitionKey("/player/dashboard")).toBe("/player/dashboard");
  });
  it("outlet subtrees use a constant key so the outlet owns depth", () => {
    expect(transitionKey("/player/leagues/l1")).toBe("league-subtree");
    expect(transitionKey("/player/community/group/g")).toBe("community-subtree");
  });
  it("detail + immersive key by pathname", () => {
    expect(transitionKey("/player/pulse")).toBe("/player/pulse");
    expect(transitionKey("/player/messages/abc")).toBe("/player/messages/abc");
  });
});
