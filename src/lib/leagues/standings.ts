import type { LeagueMatch, LeagueTeam } from "./types";

/**
 * Per-match outcome from a team's perspective, ordered oldest → newest
 * inside recentForm. F prefixes indicate forfeit-derived outcomes so
 * the UI can render them with a distinct tone.
 */
export type FormResult = "W" | "L" | "FW" | "FL";

export interface StandingRow {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  /** Number of wins earned via opponent forfeit — counted in `wins`. */
  forfeitWins: number;
  /** Number of losses recorded as own-team forfeit — counted in `losses`. */
  forfeitLosses: number;
  gamesPlayed: number;
  pointsFor: number;
  pointsAgainst: number;
  /** pointsFor − pointsAgainst. Forfeits contribute 0 to both sides. */
  pointDiff: number;
  /** pointDiff / gamesPlayed, rounded to 1dp. 0 when gamesPlayed = 0. */
  avgPointDiff: number;
  /** wins / gamesPlayed, or 0 when gamesPlayed = 0. */
  winPct: number;
  /**
   * Most recent up to 5 results in oldest→newest order. Used by the
   * StandingsTable's Form column. Empty when the team has no eligible
   * matches yet.
   */
  recentForm: FormResult[];
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
 * A match counts toward standings when EITHER:
 *   (a) both team scores are set + not tied + status ∈ (verified,
 *       score_submitted) + both team ids resolve, OR
 *   (b) status = 'forfeit' + forfeit_winner_team_id resolves to a
 *       team + both team_a_id/team_b_id resolve.
 *
 * Forfeit accounting:
 *   The winning team gets a W; the losing team gets an L. Points-for
 *   and points-against contribute 0 on both sides so a series of
 *   forfeits doesn't inflate or deflate a team's differential. This
 *   is the least-controversial default; leagues that want "forfeit
 *   = X-0 W" can layer that on later.
 *
 * Sort order (top to bottom):
 *   1. wins desc
 *   2. head-to-head vs the specific tied peer (only when EXACTLY two
 *      teams are tied on wins; ambiguous with 3-way ties, so we skip
 *      it there and fall through)
 *   3. pointDiff desc
 *   4. winPct desc
 *   5. team name asc (deterministic tiebreak so consecutive renders
 *      don't shuffle)
 */
export function computeTeamStandings(
  matches: LeagueMatch[],
  teams: LeagueTeam[],
  opts: StandingsOpts = {},
): StandingRow[] {
  const teamById = new Map(teams.map((t) => [t.id, t]));

  const inScope = (m: LeagueMatch): boolean => {
    if (opts.seasonId && m.season_id !== opts.seasonId) return false;
    if (opts.divisionId !== undefined && m.division_id !== opts.divisionId) {
      return false;
    }
    return true;
  };

  const scoreEligible = matches.filter((m) => {
    if (!inScope(m)) return false;
    if (m.team_a_score == null || m.team_b_score == null) return false;
    if (m.team_a_score === m.team_b_score) return false;
    if (m.status !== "verified" && m.status !== "score_submitted") return false;
    if (!m.team_a_id || !m.team_b_id) return false;
    return true;
  });

  const forfeitEligible = matches.filter((m) => {
    if (!inScope(m)) return false;
    if (m.status !== "forfeit") return false;
    if (!m.team_a_id || !m.team_b_id) return false;
    if (!m.forfeit_winner_team_id) return false;
    return true;
  });

  const stats = new Map<string, StandingRow>();
  const ensure = (teamId: string, teamName: string): StandingRow => {
    const existing = stats.get(teamId);
    if (existing) return existing;
    const row: StandingRow = {
      teamId, teamName,
      wins: 0, losses: 0,
      forfeitWins: 0, forfeitLosses: 0,
      gamesPlayed: 0,
      pointsFor: 0, pointsAgainst: 0, pointDiff: 0,
      avgPointDiff: 0, winPct: 0,
      recentForm: [],
    };
    stats.set(teamId, row);
    return row;
  };
  const finalize = (row: StandingRow) => {
    row.pointDiff = row.pointsFor - row.pointsAgainst;
    row.avgPointDiff = row.gamesPlayed > 0
      ? Math.round((row.pointDiff / row.gamesPlayed) * 10) / 10
      : 0;
    row.winPct = row.gamesPlayed > 0 ? row.wins / row.gamesPlayed : 0;
  };

  // Timeline of every eligible outcome per team, keyed by team id.
  // Each entry: { result, when }. We use updated_at as the finalization
  // timestamp — verified/forfeit both stamp it — and take the trailing 5.
  const timeline = new Map<string, Array<{ result: FormResult; when: string }>>();
  const pushOutcome = (teamId: string, result: FormResult, when: string) => {
    const list = timeline.get(teamId) ?? [];
    list.push({ result, when });
    timeline.set(teamId, list);
  };

  // Track pairwise wins for the head-to-head tiebreaker. Key = winner
  // teamId, value = Map<loser teamId, count>.
  const h2h = new Map<string, Map<string, number>>();
  const recordH2H = (winnerId: string, loserId: string) => {
    const inner = h2h.get(winnerId) ?? new Map();
    inner.set(loserId, (inner.get(loserId) ?? 0) + 1);
    h2h.set(winnerId, inner);
  };

  // ---- Score-based matches --------------------------------------------
  for (const m of scoreEligible) {
    const a = teamById.get(m.team_a_id!);
    const b = teamById.get(m.team_b_id!);
    if (!a || !b) continue;
    const aScore = m.team_a_score!;
    const bScore = m.team_b_score!;
    const aWon = aScore > bScore;

    const rowA = ensure(a.id, a.name);
    const rowB = ensure(b.id, b.name);
    rowA.gamesPlayed += 1;
    rowB.gamesPlayed += 1;
    rowA.pointsFor += aScore;
    rowA.pointsAgainst += bScore;
    rowB.pointsFor += bScore;
    rowB.pointsAgainst += aScore;
    if (aWon) {
      rowA.wins += 1; rowB.losses += 1; recordH2H(a.id, b.id);
      pushOutcome(a.id, "W", m.updated_at);
      pushOutcome(b.id, "L", m.updated_at);
    } else {
      rowB.wins += 1; rowA.losses += 1; recordH2H(b.id, a.id);
      pushOutcome(b.id, "W", m.updated_at);
      pushOutcome(a.id, "L", m.updated_at);
    }
  }

  // ---- Forfeits --------------------------------------------------------
  for (const m of forfeitEligible) {
    const a = teamById.get(m.team_a_id!);
    const b = teamById.get(m.team_b_id!);
    if (!a || !b) continue;
    const winnerId = m.forfeit_winner_team_id!;
    const loserId = winnerId === a.id ? b.id : a.id;
    const winner = teamById.get(winnerId);
    const loser = teamById.get(loserId);
    if (!winner || !loser) continue;

    const rowW = ensure(winner.id, winner.name);
    const rowL = ensure(loser.id, loser.name);
    rowW.gamesPlayed += 1;
    rowL.gamesPlayed += 1;
    rowW.wins += 1;
    rowW.forfeitWins += 1;
    rowL.losses += 1;
    rowL.forfeitLosses += 1;
    // Points intentionally not touched — see doc.
    recordH2H(winner.id, loser.id);
    pushOutcome(winner.id, "FW", m.updated_at);
    pushOutcome(loser.id, "FL", m.updated_at);
  }

  // Trim each team's timeline to the trailing 5 outcomes (oldest→newest)
  // so the Form column shows the most recent stretch.
  timeline.forEach((events, teamId) => {
    events.sort((a, b) => a.when.localeCompare(b.when));
    const row = stats.get(teamId);
    if (row) row.recentForm = events.slice(-5).map((e) => e.result);
  });

  // Finalize before sort so pointDiff/winPct reflect the accumulated
  // totals.
  stats.forEach(finalize);

  return Array.from(stats.values()).sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;

    // Head-to-head — only meaningful for pairwise ties. When there's
    // a 3+ way tie on wins we can't cleanly resolve pairwise, so we
    // fall through to point diff.
    const teamsAtThisWinLevel = Array.from(stats.values())
      .filter((r) => r.wins === a.wins);
    if (teamsAtThisWinLevel.length === 2) {
      const aBeatB = h2h.get(a.teamId)?.get(b.teamId) ?? 0;
      const bBeatA = h2h.get(b.teamId)?.get(a.teamId) ?? 0;
      if (aBeatB !== bBeatA) return aBeatB > bBeatA ? -1 : 1;
    }

    if (a.pointDiff !== b.pointDiff) return b.pointDiff - a.pointDiff;
    if (a.winPct !== b.winPct) return b.winPct - a.winPct;
    return a.teamName.localeCompare(b.teamName);
  });
}
