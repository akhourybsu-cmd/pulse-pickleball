import { describe, expect, it } from "vitest";
import { canPreserveAuthView } from "../../src/lib/authContinuity";

describe("keeping an open form during session checks", () => {
  const current = {
    isAuthenticated: true,
    user: { id: "player-a" },
    profile: { id: "player-a" },
  };
  it("keeps a verified view of the same player", () => {
    expect(canPreserveAuthView(current, "player-a")).toBe(true);
  });
  it("never reuses another account’s view or a cached profile without verification", () => {
    expect(canPreserveAuthView(current, "player-b")).toBe(false);
    expect(
      canPreserveAuthView({ ...current, isAuthenticated: false }, "player-a")
    ).toBe(false);
    expect(canPreserveAuthView({ ...current, user: null }, "player-a")).toBe(
      false
    );
    expect(canPreserveAuthView({ ...current, profile: null }, "player-a")).toBe(
      false
    );
    expect(
      canPreserveAuthView(
        { ...current, profile: { id: "player-b" } },
        "player-a"
      )
    ).toBe(false);
  });
});
