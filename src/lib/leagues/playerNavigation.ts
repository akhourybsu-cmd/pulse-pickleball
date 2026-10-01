export const PLAYER_LEAGUE_TABS = [
  "gameday",
  "standings",
  "schedule",
  "results",
  "team",
  "info",
] as const;
export type PlayerLeagueTab = (typeof PLAYER_LEAGUE_TABS)[number];

/** Keep existing notification and match links working after introducing tabs. */
export function playerLeagueTabFromHash(hash: string): PlayerLeagueTab {
  const key = hash.replace(/^#/, "");
  if (key === "upcoming") return "gameday";
  if (key === "past") return "results";
  return PLAYER_LEAGUE_TABS.includes(key as PlayerLeagueTab)
    ? (key as PlayerLeagueTab)
    : "gameday";
}
