import { describe, it, expect } from "vitest";
import {
  areaRank,
  nearbyCommunities,
  matchesCommunity,
} from "@/lib/community/discovery";
import type { Group } from "@/hooks/useGroups";
const make = (name: string, city: string, state: string, extra = {}) =>
  ({ name, city, state, ...extra }) as Group;
describe("community discovery", () => {
  it("prioritizes town then state, preserving order within each area without mutating the source", () => {
    const rows = [
      make("Away", "Austin", "TX"),
      make("State", "Boston", "Massachusetts"),
      make("Local A", "Attleboro", "ma"),
      make("Local B", "Attleboro", "MA"),
    ];
    expect(
      nearbyCommunities(rows, {
        city: " Attleboro ",
        state: "Massachusetts",
      }).map((x) => x.name),
    ).toEqual(["Local A", "Local B", "State", "Away"]);
    expect(rows[0].name).toBe("Away");
    expect(nearbyCommunities(rows, { city: "", state: "" })).toEqual(rows);
  });
  it("uses current venue location and searches every term across identity and location", () => {
    const group = make("Old group", "Austin", "TX", {
      venue: {
        name: "Rally Haus Sports",
        city: "Attleboro",
        state: "Massachusetts",
        tagline: "Courts and clinics",
      },
    });
    expect(areaRank(group, { city: "Attleboro", state: "MA" })).toBe(0);
    expect(matchesCommunity(group, " RALLY ma clinics ")).toBe(true);
    expect(matchesCommunity(group, "rally boston")).toBe(false);
    expect(matchesCommunity(group, "%")).toBe(false);
  });
});
