/** Preserve the season shown on a card when entering the league. */
export function playerLeaguePath(leagueId: string, seasonId?: string | null) {
  return `/player/leagues/${encodeURIComponent(leagueId)}${seasonId ? `?season=${encodeURIComponent(seasonId)}` : ""}`;
}

export function leagueInvitePath(code: string) {
  return `/player/leagues/join/${encodeURIComponent(code.trim())}`;
}

/** Shared links and printed QR codes must work outside native/custom-domain shells. */
export function leagueInviteUrl(code: string) {
  return `https://pulsepb.com${leagueInvitePath(code)}`;
}

export const PLAYER_LEAGUE_TABS = [
  "gameday",
  "standings",
  "schedule",
  "results",
  "team",
  "info",
  "feed",
] as const;
export type PlayerLeagueTab = (typeof PLAYER_LEAGUE_TABS)[number];

/** Feed is always sixth; team leagues retain their additional info section. */
export function visiblePlayerLeagueTabs(isTeamMode: boolean): PlayerLeagueTab[] {
  return ["gameday", "standings", "schedule", "results", isTeamMode ? "team" : "info", "feed",
    ...(isTeamMode ? ["info" as const] : [])];
}

/** Keep existing notification and match links working after introducing tabs. */
export function playerLeagueTabFromHash(hash: string): PlayerLeagueTab {
  const key = hash.replace(/^#/, "");
  if (key === "upcoming") return "gameday";
  if (key === "past") return "results";
  return PLAYER_LEAGUE_TABS.includes(key as PlayerLeagueTab)
    ? (key as PlayerLeagueTab)
    : "gameday";
}
