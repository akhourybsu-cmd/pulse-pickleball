import { describe, expect, it } from "vitest";
import {
  leagueInvitePath,
  leagueInviteUrl,
  playerLeaguePath,
} from "@/lib/leagues/playerNavigation";
import { upcomingLeagueDate, upcomingLeagueWhen } from "@/lib/leagues/upcoming";

describe("league surface links and time labels", () => {
  it("preserves the displayed season and creates external links independent of the current host", () => {
    expect(playerLeaguePath("league", "autumn")).toBe(
      "/player/leagues/league?season=autumn"
    );
    expect(playerLeaguePath("league")).toBe("/player/leagues/league");
    expect(leagueInvitePath(" FALL_26 ")).toBe("/player/leagues/join/FALL_26");
    expect(leagueInviteUrl("FALL_26")).toBe(
      "https://pulsepb.com/player/leagues/join/FALL_26"
    );
    expect(leagueInvitePath("bad/?code")).toBe(
      "/player/leagues/join/bad%2F%3Fcode"
    );
  });
  it("keeps session wall-clock times consistent with the schedule rather than converting them from UTC", () => {
    const row = {
      scheduled_time: "2027-02-01T18:30:00Z",
      has_match_time: false,
      session_date: "2027-02-01",
      session_start_time: "18:30:00",
    };
    expect(upcomingLeagueDate(row)?.getHours()).toBe(18);
    expect(upcomingLeagueWhen(row)).toBe("Mon Feb 1 · 6:30 PM");
    expect(
      upcomingLeagueDate({ ...row, has_match_time: true })?.toISOString()
    ).toBe(row.scheduled_time.replace("Z", ".000Z"));
  });
  it("does not invent a midnight start or crash on a missing/invalid time", () => {
    expect(
      upcomingLeagueWhen({
        scheduled_time: null,
        has_match_time: false,
        session_date: "2027-02-01",
      })
    ).toBe("Mon Feb 1 · Time to be announced");
    expect(upcomingLeagueWhen({ scheduled_time: "invalid" })).toBe(
      "Time to be announced"
    );
    expect(upcomingLeagueWhen({ scheduled_time: null })).toBe(
      "Time to be announced"
    );
  });
});
