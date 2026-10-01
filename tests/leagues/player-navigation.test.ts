import { describe, expect, it } from "vitest";
import {
  playerLeagueTabFromHash,
  PLAYER_LEAGUE_TABS,
} from "@/lib/leagues/playerNavigation";
import {
  GROUPS,
  visibleManageTabs,
} from "@/components/admin/leagues/leagueManageTabs";

describe("player league navigation", () => {
  it("preserves existing links to unfinished games and match history", () => {
    expect(playerLeagueTabFromHash("#upcoming")).toBe("gameday");
    expect(playerLeagueTabFromHash("#past")).toBe("results");
    expect(playerLeagueTabFromHash("#team")).toBe("team");
    expect(playerLeagueTabFromHash("#standings")).toBe("standings");
  });
  it("restores each shared section and recovers safely from unknown fragments", () => {
    for (const tab of PLAYER_LEAGUE_TABS)
      expect(playerLeagueTabFromHash(`#${tab}`)).toBe(tab);
    expect(playerLeagueTabFromHash("")).toBe("gameday");
    expect(playerLeagueTabFromHash("#removed-section")).toBe("gameday");
  });
  it("keeps every applicable manager tool reachable once in the grouped menu", () => {
    for (const format of ["ladder", "doubles", "singles", "team", "flex"]) {
      const tabs = visibleManageTabs(format);
      const grouped = GROUPS.flatMap((group) =>
        tabs.filter((tab) => tab.group === group)
      );
      expect(new Set(grouped.map((tab) => tab.key)).size).toBe(tabs.length);
      expect(grouped).toHaveLength(tabs.length);
      expect(grouped.some((tab) => tab.key === "ladder")).toBe(
        format === "ladder"
      );
      expect(grouped.some((tab) => tab.key === "teams")).toBe(
        format === "doubles" || format === "team"
      );
    }
  });
});
