/**
 * Standings and tiebreaking.
 *
 * The previous implementation passed head-to-head into `Array.prototype.sort`
 * as a pairwise comparator. Head-to-head is NOT transitive — A beats B, B beats
 * C, C beats A is an ordinary outcome — and a non-transitive comparator makes
 * sort's result depend on the order it happens to compare elements in, which is
 * engine-defined. Two browsers could disagree about who advances out of a pool.
 *
 * The fix is the rule real tournaments actually use: never compare two teams in
 * isolation. Group the teams that are level, then break the whole group at once
 * with successively finer criteria:
 *
 *   1. match win percentage (percentage, not wins, so uneven pool sizes are fair)
 *   2. record in matches among the tied teams only
 *      — for a group of two that is exactly head-to-head
 *   3. point differential in matches among the tied teams only
 *   4. overall point differential
 *   5. total points scored
 *   6. team name, so the result is deterministic rather than arbitrary
 *
 * When a criterion splits a group but leaves a smaller group still level, that
 * subgroup restarts from criterion 2. That is deliberate and matches USA
 * Pickleball's rule: once a three-way tie collapses to two teams, you go back
 * to the head-to-head between those two.
 */

export interface StandingsTeam {
  id: string;
  team_name: string;
  pool?: string | null;
}

export interface StandingsMatch {
  team1_id: string | null;
  team2_id: string | null;
  team1_score: number | null;
  team2_score: number | null;
  status: string;
}

export interface Standing {
  teamId: string;
  teamName: string;
  pool: string | null;
  wins: number;
  losses: number;
  played: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  /** 1-based finishing position within the set that was ranked. */
  rank: number;
  /** Which criterion settled this team's position, when it wasn't record alone. */
  tiebreak?: string;
}

interface Criterion {
  /** Label shown to organizers; depends on group size for head-to-head. */
  label: (groupSize: number) => string;
  /** Higher is better. Compared within the group being broken. */
  value: (s: Standing, group: Standing[], matches: StandingsMatch[]) => number;
}

/** A completed match with both teams and both scores present. */
function isCounted(m: StandingsMatch): boolean {
  return (
    m.status === 'completed' &&
    !!m.team1_id &&
    !!m.team2_id &&
    m.team1_score !== null &&
    m.team1_score !== undefined &&
    m.team2_score !== null &&
    m.team2_score !== undefined
  );
}

/** Totals for `teamId` across `matches`, ignoring opponents outside `within`. */
function tallyAgainst(
  teamId: string,
  matches: StandingsMatch[],
  within: Set<string> | null,
): { wins: number; played: number; diff: number } {
  let wins = 0;
  let played = 0;
  let diff = 0;

  for (const m of matches) {
    if (!isCounted(m)) continue;

    const isA = m.team1_id === teamId;
    const isB = m.team2_id === teamId;
    if (!isA && !isB) continue;

    const opponent = (isA ? m.team2_id : m.team1_id) as string;
    if (within && !within.has(opponent)) continue;

    const mine = (isA ? m.team1_score : m.team2_score) as number;
    const theirs = (isA ? m.team2_score : m.team1_score) as number;

    played += 1;
    diff += mine - theirs;
    if (mine > theirs) wins += 1;
  }

  return { wins, played, diff };
}

const CRITERIA: Criterion[] = [
  {
    label: () => 'Win percentage',
    value: (s) => s.winPct,
  },
  {
    label: (n) => (n === 2 ? 'Head-to-head' : 'Record vs tied teams'),
    value: (s, group, matches) => {
      const ids = new Set(group.map((g) => g.teamId));
      const { wins, played } = tallyAgainst(s.teamId, matches, ids);
      return played === 0 ? 0 : wins / played;
    },
  },
  {
    label: (n) => (n === 2 ? 'Point diff head-to-head' : 'Point diff vs tied teams'),
    value: (s, group, matches) => {
      const ids = new Set(group.map((g) => g.teamId));
      return tallyAgainst(s.teamId, matches, ids).diff;
    },
  },
  {
    label: () => 'Overall point differential',
    value: (s) => s.pointDiff,
  },
  {
    label: () => 'Total points scored',
    value: (s) => s.pointsFor,
  },
];

/**
 * Order a group of teams that are level on everything checked so far.
 *
 * Terminates because a criterion that splits the group produces strictly
 * smaller subgroups, and a criterion that doesn't split moves the index on.
 */
function orderGroup(
  group: Standing[],
  matches: StandingsMatch[],
  fromCriterion: number,
): Standing[] {
  if (group.length <= 1) return group;

  for (let i = fromCriterion; i < CRITERIA.length; i++) {
    const criterion = CRITERIA[i];
    const scored = group.map((s) => ({ s, key: criterion.value(s, group, matches) }));
    const distinct = new Set(scored.map((x) => x.key));

    // Criterion says nothing about this group — try a finer one.
    if (distinct.size <= 1) continue;

    const buckets = [...distinct]
      .sort((a, b) => b - a)
      .map((key) => scored.filter((x) => x.key === key).map((x) => x.s));

    return buckets.flatMap((bucket) => {
      // Only note a tiebreak when one was genuinely needed: the group arrived
      // here level, and this criterion is what separated it.
      if (i > 0) {
        for (const s of bucket) s.tiebreak = criterion.label(group.length);
      }
      // Every bucket is strictly smaller than the group, so restarting at the
      // head-to-head criterion cannot loop. A three-way tie that collapses to
      // two is re-judged on those two teams' meeting, which is the point.
      return orderGroup(bucket, matches, 1);
    });
  }

  // Genuinely inseparable. Sort by name so the table is stable across reloads
  // rather than dependent on the order rows came back from the database.
  return [...group].sort((a, b) => a.teamName.localeCompare(b.teamName));
}

/**
 * Full standings for a set of teams over a set of matches.
 *
 * `matches` should already be scoped to what's being ranked — pass only a
 * pool's matches to rank that pool, or the whole division for a round robin.
 */
export function computeStandings(
  teams: StandingsTeam[],
  matches: StandingsMatch[],
): Standing[] {
  const rows = new Map<string, Standing>();

  for (const t of teams) {
    rows.set(t.id, {
      teamId: t.id,
      teamName: t.team_name,
      pool: t.pool ?? null,
      wins: 0,
      losses: 0,
      played: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
      rank: 0,
    });
  }

  for (const m of matches) {
    if (!isCounted(m)) continue;
    const a = rows.get(m.team1_id as string);
    const b = rows.get(m.team2_id as string);
    if (!a || !b) continue;

    const sa = m.team1_score as number;
    const sb = m.team2_score as number;

    a.played += 1;
    b.played += 1;
    a.pointsFor += sa;
    a.pointsAgainst += sb;
    b.pointsFor += sb;
    b.pointsAgainst += sa;

    // Pickleball can't end level, but a bad score entry shouldn't invent a win.
    if (sa > sb) {
      a.wins += 1;
      b.losses += 1;
    } else if (sb > sa) {
      b.wins += 1;
      a.losses += 1;
    }
  }

  for (const s of rows.values()) {
    s.pointDiff = s.pointsFor - s.pointsAgainst;
    s.winPct = s.played === 0 ? 0 : s.wins / s.played;
  }

  const ordered = orderGroup([...rows.values()], matches, 0);
  ordered.forEach((s, i) => {
    s.rank = i + 1;
  });
  return ordered;
}
