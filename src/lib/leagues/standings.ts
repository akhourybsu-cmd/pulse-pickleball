import type { LeagueMatch, LeagueTeam } from "./types";

export interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  /** pointsFor − pointsAgainst */
  pointDiff: number;
  /** wins / gamesPlayed, or 0 when gamesPlayed = 0 */
  winPct: number;
}

interface StandingsOpts {
  /** If provided, only matches with this season_id contribute. */
  seasonId?: string;
  /** If provided, only matches with this division_id contribute. */
  divisionId?: string | null;
}

/**
 * Pure computation. No fetch, no side effects, safe to call from
 * either admin or player surfaces.
 *
 * Match counts toward a standing when:
 *   - both team_a_score and team_b_score are set
 *   - the scores aren't equal (pickleball doesn't tie)
 *   - status is one of ('verified', 'score_submitted')
 *   - both team_a_id and team_b_id resolve to teams we know about
 *
 * Sort order:
 *   wins desc → pointDiff desc → winPct desc → team name asc (stable
 *   deterministic tiebreak so consecutive renders don't shuffle).
 */
export function computeTeamStandings(
  matches: LeagueMatch[],
  teams: LeagueTeam[],
  opts: StandingsOpts = {},
): StandingRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const eligible = matches.filter((m) => {
    if (m.team_a_score == null || m.team_b_score == null) return false;
    if (m.team_a_score === m.team_b_score) return false;
    if (m.status !== "verified" && m.status !== "score_submitted") return false;
    if (!m.team_a_id || !m.team_b_id) return false;
    if (opts.seasonId && m.season_id !== opts.seasonId) return false;
    if (opts.divisionId !== undefined && m.division_id !== opts.divisionId) {
      return false;
    }
    return true;
  });

  const stats = new Map<string, StandingRow>();
  const record = (
    teamId: string,
    teamName: string,
    won: boolean,
    ptsFor: number,
    ptsAgainst: number,
  ) => {
    const row =
      stats.get(teamId) ??
      {
        teamId, teamName,
        wins: 0, losses: 0, gamesPlayed: 0,
        pointsFor: 0, pointsAgainst: 0, pointDiff: 0, winPct: 0,
      };
    row.gamesPlayed += 1;
    if (won) row.wins += 1;
    else row.losses += 1;
    row.pointsFor += ptsFor;
    row.pointsAgainst += ptsAgainst;
    row.pointDiff = row.pointsFor - row.pointsAgainst;
    row.winPct = row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0;
    stats.set(teamId, row);
  };

  for (const m of eligible) {
    const teamA = teamById.get(m.team_a_id!);
    const teamB = teamById.get(m.team_b_id!);
    if (!teamA || !teamB) continue;
    const aScore = m.team_a_score!;
    const bScore = m.team_b_score!;
    const aWon = aScore > bScore;
    record(teamA.id, teamA.name, aWon, aScore, bScore);
    record(teamB.id, teamB.name, !aWon, bScore, aScore);
  }

  return Array.from(stats.values()).sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;
    if (a.winPct !== b.winPct) return b.winPct - a.winPct;
    return a.teamName.localeCompare(b.teamName);
  });
}
