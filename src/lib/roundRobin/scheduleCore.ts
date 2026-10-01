/**
 * Deterministic round-robin scheduling core (Slice 3).
 *
 * Pure, DB-free, network-free primitives extracted from the
 * `generate-round-robin-schedule` edge function so that the participant-change
 * planner (`scoreRemainingSchedule`) and, later, the Slice 2b server
 * orchestration can share ONE implementation of the fairness algorithm.
 *
 * Nothing in this file reads a database, performs I/O, or touches wall-clock
 * time. Given the same inputs it always produces the same output — the seeded
 * RNG is keyed off the caller-supplied seed only. This is what lets the planner
 * be unit-tested exhaustively without a live project.
 *
 * Seats are represented by opaque "seat ids": `p:<uuid>` for a registered
 * profile, `g:<uuid>` for a guest. The scheduler treats them as opaque tokens
 * exactly as the edge function does; callers split them back into
 * player/guest columns at persistence time.
 */

export type SeatId = string; // "p:<uuid>" | "g:<uuid>"

/** A doubles (or bye) match in synthetic-seat form. */
export interface CoreMatch {
  round_no: number;
  court_no: number;
  a1: SeatId | null;
  a2: SeatId | null;
  b1: SeatId | null;
  b2: SeatId | null;
  is_bye: boolean;
}

export type EventFormat = "open" | "mixed" | "male" | "female";

export interface PlayerStats {
  seatId: SeatId;
  gamesPlayed: number;
  byesReceived: number;
  lastPlayedRound: number;
  partnerCounts: Map<SeatId, number>;
  opponentCounts: Map<SeatId, number>;
  courtUsage: Map<number, number>;
  lastPartner: SeatId | null;
  lastOpponents: SeatId[];
}

/**
 * Deterministic seeded RNG. Identical to the edge function's implementation so
 * TS-side regeneration matches server-side generation bit-for-bit for the same
 * seed. Do NOT "improve" this without also changing the edge function — the two
 * must stay in lockstep until Slice 2b unifies them.
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = seed.split("").reduce((acc, char) => {
      return (acc << 5) - acc + char.charCodeAt(0);
    }, 0);
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

export interface ScheduleMetrics {
  matchesPerRound: number;
  onCourtPerRound: number;
  byesPerRound: number;
  targetGames: number;
  targetByes: number;
  totalCourts: number;
  /** Courts that can actually be filled by this roster. */
  usableCourts: number;
  /** Requested courts that will sit idle each round. */
  unusedCourts: number;
  rounds: number;
}

/** Mirrors the edge function's metric calculation. */
export function calculateMetrics(
  players: number,
  courts: number,
  gamesPerPlayer: number,
  equalGames = false
): ScheduleMetrics {
  const playerCount = Math.max(0, Math.floor(players));
  const courtCount = Math.max(0, Math.floor(courts));
  const requestedGames = Math.max(0, Math.floor(gamesPerPlayer));
  const targetGames = equalGames ? equalGameTarget(playerCount, requestedGames) : requestedGames;
  const maxPossibleMatches = Math.floor(playerCount / 4);
  const matchesPerRound = Math.min(courtCount, maxPossibleMatches);
  const onCourtPerRound = 4 * matchesPerRound;
  const byesPerRound = Math.max(0, playerCount - onCourtPerRound);

  const gamesPerRoundPerPlayer =
    playerCount > 0 ? onCourtPerRound / playerCount : 0;
  const rounds =
    gamesPerRoundPerPlayer > 0
      ? Math.ceil(targetGames / gamesPerRoundPerPlayer)
      : 0;

  const totalByes = equalGames ? rounds * playerCount - playerCount * targetGames : rounds * byesPerRound;
  const targetByes =
    totalByes > 0 && playerCount > 0 ? Math.round(totalByes / playerCount) : 0;

  return {
    matchesPerRound,
    onCourtPerRound,
    byesPerRound,
    targetGames,
    targetByes,
    totalCourts: courtCount,
    usableCourts: matchesPerRound,
    unusedCourts: Math.max(0, courtCount - matchesPerRound),
    rounds,
  };
}

function emptyStats(seatId: SeatId): PlayerStats {
  return {
    seatId,
    gamesPlayed: 0,
    byesReceived: 0,
    lastPlayedRound: 0,
    partnerCounts: new Map(),
    opponentCounts: new Map(),
    courtUsage: new Map(),
    lastPartner: null,
    lastOpponents: [],
  };
}

function applyMatchToStats(
  match: CoreMatch,
  stats: Map<SeatId, PlayerStats>
): void {
  if (match.is_bye) {
    const byePlayer = match.a1;
    if (byePlayer && stats.has(byePlayer)) {
      stats.get(byePlayer)!.byesReceived++;
    }
    return;
  }

  const players = [match.a1, match.a2, match.b1, match.b2].filter(
    (id): id is SeatId => id !== null
  );
  if (players.length !== 4) return;

  const [a1, a2, b1, b2] = players;
  const teamA = [a1, a2];
  const teamB = [b1, b2];

  players.forEach((seatId) => {
    const stat = stats.get(seatId);
    if (!stat) return;
    stat.gamesPlayed++;
    stat.lastPlayedRound = Math.max(stat.lastPlayedRound, match.round_no);
    stat.courtUsage.set(
      match.court_no,
      (stat.courtUsage.get(match.court_no) || 0) + 1
    );

    let partner: SeatId;
    let opponents: SeatId[];
    if (seatId === a1) {
      partner = a2;
      opponents = teamB;
    } else if (seatId === a2) {
      partner = a1;
      opponents = teamB;
    } else if (seatId === b1) {
      partner = b2;
      opponents = teamA;
    } else {
      partner = b1;
      opponents = teamA;
    }

    stat.partnerCounts.set(partner, (stat.partnerCounts.get(partner) || 0) + 1);
    stat.lastPartner = partner;
    opponents.forEach((opp) => {
      stat.opponentCounts.set(opp, (stat.opponentCounts.get(opp) || 0) + 1);
    });
    stat.lastOpponents = opponents;
  });
}

/** Build player stats, seeding from an optional set of already-played matches. */
export function buildPlayerStats(
  seatIds: SeatId[],
  playedMatches: CoreMatch[] = []
): Map<SeatId, PlayerStats> {
  const stats = new Map<SeatId, PlayerStats>();
  seatIds.forEach((id) => stats.set(id, emptyStats(id)));
  // Only fold in matches whose participants we still know about.
  playedMatches.forEach((m) => applyMatchToStats(m, stats));
  return stats;
}

function pairPenalty(p1: PlayerStats, p2Id: SeatId): number {
  const partnerCount = p1.partnerCounts.get(p2Id) || 0;
  const teamedLast = p1.lastPartner === p2Id ? 1 : 0;
  // Every repeat matters; a third pairing must cost more than a second. The
  // old boolean penalty treated both identically and could cluster repeats.
  return 8 * partnerCount + 6 * teamedLast;
}

function opponentPenalty(
  team1: [SeatId, SeatId],
  team2: [SeatId, SeatId],
  stats: Map<SeatId, PlayerStats>
): number {
  let totalMeetings = 0;
  let metLastRound = 0;
  team1.forEach((p1) => {
    team2.forEach((p2) => {
      const s1 = stats.get(p1);
      if (!s1) return;
      totalMeetings += s1.opponentCounts.get(p2) || 0;
      if (s1.lastOpponents.includes(p2)) metLastRound = 1;
    });
  });
  return 2 * totalMeetings + 4 * metLastRound;
}

function selectPlayersForRound(
  roundNo: number,
  allPlayers: SeatId[],
  onCourt: number,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom
): { playing: SeatId[]; resting: SeatId[] } {
  // Shuffle once, then use a lawful/stable comparator. Calling RNG from a sort
  // comparator makes its answer depend on engine-specific comparison order.
  const sorted = rng.shuffle(allPlayers).sort((a, b) => {
    const aS = stats.get(a)!;
    const bS = stats.get(b)!;
    if (aS.gamesPlayed !== bS.gamesPlayed)
      return aS.gamesPlayed - bS.gamesPlayed;
    const aRest = roundNo - aS.lastPlayedRound;
    const bRest = roundNo - bS.lastPlayedRound;
    if (aRest !== bRest) return bRest - aRest;
    return 0;
  });
  return { playing: sorted.slice(0, onCourt), resting: sorted.slice(onCourt) };
}

function assignByes(
  resting: SeatId[],
  byesNeeded: number,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom
): SeatId[] {
  const sorted = rng.shuffle(resting).sort((a, b) => {
    const aS = stats.get(a)!;
    const bS = stats.get(b)!;
    if (aS.gamesPlayed !== bS.gamesPlayed)
      return bS.gamesPlayed - aS.gamesPlayed;
    if (aS.lastPlayedRound !== bS.lastPlayedRound)
      return bS.lastPlayedRound - aS.lastPlayedRound;
    if (aS.byesReceived !== bS.byesReceived)
      return aS.byesReceived - bS.byesReceived;
    return 0;
  });
  return sorted.slice(0, byesNeeded);
}

/**
 * Minimum-cost perfect pairing for the normal event sizes. The former greedy
 * walk could repeat a partner even when a repeat-free solution existed later
 * in the same round. Bitmask DP considers the complete round as one decision.
 * Very large social events fall back to deterministic greedy pairing to keep
 * generation latency bounded.
 */
function minimumCostPairs<T>(
  values: T[],
  penaltyFor: (left: T, right: T) => number,
  rng: SeededRandom
): Array<[T, T]> {
  const ordered = rng.shuffle(values);
  if (ordered.length > 16) {
    const remaining = [...ordered];
    const pairs: Array<[T, T]> = [];
    while (remaining.length >= 2) {
      const left = remaining.shift()!;
      let bestIndex = 0;
      let bestPenalty = Number.POSITIVE_INFINITY;
      remaining.forEach((right, index) => {
        const penalty = penaltyFor(left, right);
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestIndex = index;
        }
      });
      pairs.push([left, remaining.splice(bestIndex, 1)[0]]);
    }
    // Repair greedy traps on larger rosters without exponential search. A
    // swap changes two partnerships but never changes anyone's game count.
    for (let pass = 0; pass < pairs.length; pass++) {
      let improved = false;
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const [a, b] = pairs[i], [c, d] = pairs[j];
          const old = penaltyFor(a, b) + penaltyFor(c, d);
          const cross = penaltyFor(a, c) + penaltyFor(b, d);
          const alternate = penaltyFor(a, d) + penaltyFor(b, c);
          if (Math.min(cross, alternate) >= old) continue;
          [pairs[i], pairs[j]] = cross <= alternate ? [[a, c], [b, d]] : [[a, d], [b, c]];
          improved = true;
        }
      }
      if (!improved) break;
    }
    return pairs;
  }

  interface Result {
    cost: number;
    pairs: Array<[number, number]>;
  }
  const memo = new Map<number, Result>();
  const solve = (mask: number): Result => {
    if (mask === 0) return { cost: 0, pairs: [] };
    const cached = memo.get(mask);
    if (cached) return cached;
    let leftIndex = 0;
    while ((mask & (1 << leftIndex)) === 0) leftIndex += 1;
    const withoutLeft = mask & ~(1 << leftIndex);
    let best: Result = { cost: Number.POSITIVE_INFINITY, pairs: [] };
    for (let rightIndex = leftIndex + 1; rightIndex < ordered.length; rightIndex += 1) {
      if ((withoutLeft & (1 << rightIndex)) === 0) continue;
      const tail = solve(withoutLeft & ~(1 << rightIndex));
      const cost = penaltyFor(ordered[leftIndex], ordered[rightIndex]) + tail.cost;
      if (cost < best.cost) {
        best = { cost, pairs: [[leftIndex, rightIndex], ...tail.pairs] };
      }
    }
    memo.set(mask, best);
    return best;
  };

  return solve((1 << ordered.length) - 1).pairs.map(([left, right]) => [
    ordered[left],
    ordered[right],
  ]);
}

function minimumCostBipartitePairs<T, U>(
  leftValues: T[],
  rightValues: U[],
  penaltyFor: (left: T, right: U) => number,
  rng: SeededRandom
): Array<[T, U]> {
  const left = rng.shuffle(leftValues);
  const right = rng.shuffle(rightValues);
  const count = Math.min(left.length, right.length);
  if (count > 16) {
    const available = [...right];
    return left.slice(0, count).map((leftValue) => {
      let bestIndex = 0;
      let bestPenalty = Number.POSITIVE_INFINITY;
      available.forEach((rightValue, index) => {
        const penalty = penaltyFor(leftValue, rightValue);
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestIndex = index;
        }
      });
      return [leftValue, available.splice(bestIndex, 1)[0]];
    });
  }

  interface Result {
    cost: number;
    rightIndexes: number[];
  }
  const memo = new Map<string, Result>();
  const solve = (leftIndex: number, usedMask: number): Result => {
    if (leftIndex === count) return { cost: 0, rightIndexes: [] };
    const key = `${leftIndex}:${usedMask}`;
    const cached = memo.get(key);
    if (cached) return cached;
    let best: Result = { cost: Number.POSITIVE_INFINITY, rightIndexes: [] };
    for (let rightIndex = 0; rightIndex < count; rightIndex += 1) {
      if ((usedMask & (1 << rightIndex)) !== 0) continue;
      const tail = solve(leftIndex + 1, usedMask | (1 << rightIndex));
      const cost = penaltyFor(left[leftIndex], right[rightIndex]) + tail.cost;
      if (cost < best.cost) {
        best = { cost, rightIndexes: [rightIndex, ...tail.rightIndexes] };
      }
    }
    memo.set(key, best);
    return best;
  };
  const selected = solve(0, 0).rightIndexes;
  return selected.map((rightIndex, leftIndex) => [left[leftIndex], right[rightIndex]]);
}

function formTeams(
  players: SeatId[],
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom
): Array<[SeatId, SeatId]> {
  return minimumCostPairs(
    players,
    (left, right) =>
      pairPenalty(stats.get(left)!, right) + pairPenalty(stats.get(right)!, left),
    rng
  );
}

function formTeamsMixed(
  males: SeatId[],
  females: SeatId[],
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom
): Array<[SeatId, SeatId]> {
  return minimumCostBipartitePairs(
    males,
    females,
    (male, female) =>
      pairPenalty(stats.get(male)!, female) + pairPenalty(stats.get(female)!, male),
    rng
  );
}

function pairOpponents(
  teams: Array<[SeatId, SeatId]>,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom
): Array<{ teamA: [SeatId, SeatId]; teamB: [SeatId, SeatId] }> {
  return minimumCostPairs(
    teams,
    (left, right) =>
      opponentPenalty(left, right, stats) + opponentPenalty(right, left, stats),
    rng
  ).map(([teamA, teamB]) => ({ teamA, teamB }));
}

function assignCourts(
  pairings: Array<{ teamA: [SeatId, SeatId]; teamB: [SeatId, SeatId] }>,
  stats: Map<SeatId, PlayerStats>,
  totalCourts: number,
  rng: SeededRandom
): Array<{
  pairing: { teamA: [SeatId, SeatId]; teamB: [SeatId, SeatId] };
  courtNo: number;
}> {
  const available = new Set(
    rng.shuffle(Array.from({ length: totalCourts }, (_, index) => index + 1))
  );

  return pairings.map((pairing) => {
    const players = [...pairing.teamA, ...pairing.teamB];
    let selected = Array.from(available)[0];
    let selectedPenalty = Number.POSITIVE_INFINITY;
    for (const courtNo of available) {
      const penalty = players.reduce(
        (sum, seatId) =>
          sum + (stats.get(seatId)?.courtUsage.get(courtNo) || 0),
        0
      );
      if (penalty < selectedPenalty) {
        selected = courtNo;
        selectedPenalty = penalty;
      }
    }
    available.delete(selected);
    return { pairing, courtNo: selected };
  });
}

export interface RegenerateOptions {
  seed: string;
  seatIds: SeatId[];
  numCourts: number;
  gamesPerPlayer: number;
  /** First round to (re)generate. Rounds before this are treated as frozen. */
  startFromRound: number;
  /** Total rounds the event should end with. */
  totalRounds: number;
  format?: EventFormat;
  /** Frozen (already-played / protected) matches used to seed fairness stats. */
  frozenMatches?: CoreMatch[];
  /** Gender by seat id, required for `mixed`/`male`/`female` formats. */
  genders?: Map<SeatId, string>;
  /**
   * Virtual prior-game credit used for late joins/substitutes. Credits affect
   * future selection balance but are not emitted as matches or fairness data.
   */
  initialGameCredits?: Map<SeatId, number>;
}

/** Smallest uniform total that can be divided into four-player games. */
export function equalGameTarget(players: number, requested: number): number {
  const step = players % 2 ? 4 : players % 4 ? 2 : 1;
  return Math.ceil(requested / step) * step;
}

/**
 * Construct exact player-game obligations first, then optimize partners. Court
 * capacity is a ceiling, never an obligation to give somebody an extra game.
 * Highest-remaining-degree allocation realizes a bipartite player/round graph;
 * if the shortest candidate cannot fit, add a round, down to one match per
 * round. The caller validates divisibility and feasible individual deficits.
 */
export function generateEqualRounds(opts: Omit<RegenerateOptions, "totalRounds">): CoreMatch[] {
  const { seatIds, numCourts, gamesPerPlayer, startFromRound, format = "open",
    genders = new Map<SeatId, string>(), frozenMatches = [] } = opts;
  const initial = buildPlayerStats(seatIds, frozenMatches);
  const deficits = seatIds.map(id => gamesPerPlayer - initial.get(id)!.gamesPlayed);
  const total = deficits.reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];
  if (deficits.some(n => n < 0) || total % 4 !== 0 || Math.max(...deficits) > total / 4) {
    throw new Error("These remaining game totals cannot form complete doubles matches.");
  }
  const male = seatIds.filter(id => genders.get(id)?.trim().toLowerCase() === "male");
  const female = seatIds.filter(id => genders.get(id)?.trim().toLowerCase() === "female");
  if (format === "mixed" && (male.length + female.length !== seatIds.length ||
    male.reduce((sum, id) => sum + gamesPerPlayer - initial.get(id)!.gamesPlayed, 0) !== total / 2)) {
    throw new Error("Equal mixed doubles needs equal remaining games for men and women.");
  }
  const maxCourts = Math.min(numCourts, Math.floor(seatIds.length / 4),
    format === "mixed" ? Math.floor(male.length / 2) : numCourts,
    format === "mixed" ? Math.floor(female.length / 2) : numCourts);
  if (maxCourts < 1) throw new Error("Need enough eligible players for a doubles court.");
  const matchCount = total / 4;
  const minimumRounds = Math.max(Math.ceil(matchCount / maxCourts), ...deficits);

  for (let roundCount = minimumRounds; roundCount <= matchCount; roundCount++) {
    let best: CoreMatch[] | null = null;
    let bestRepeats = Infinity;
    // Multiple deterministic rotations avoid committing to an unlucky early
    // partner choice. Work stays bounded, including large social rosters.
    const attempts = seatIds.length <= 40 ? 12 : 4;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const rng = new SeededRandom(`${opts.seed}:equal:${roundCount}:${attempt}`);
      const remaining = new Map(seatIds.map((id, i) => [id, deficits[i]]));
      const stats = buildPlayerStats(seatIds, frozenMatches);
      const generated: CoreMatch[] = [];
      let valid = true;
      for (let index = 0; index < roundCount; index++) {
        const round = startFromRound + index;
        // Balanced round sizes also avoid a tiny final round stranding a player
        // who still needs multiple games. Larger rounds come first for Havel–Hakimi.
        const courts = Math.floor(matchCount / roundCount) + (index < matchCount % roundCount ? 1 : 0);
        const select = (pool: SeatId[], count: number) => rng.shuffle(pool)
          .filter(id => remaining.get(id)! > 0)
          .sort((a, b) => remaining.get(b)! - remaining.get(a)! ||
            stats.get(a)!.lastPlayedRound - stats.get(b)!.lastPlayedRound)
          .slice(0, count);
        const playing = format === "mixed"
          ? [...select(male, courts * 2), ...select(female, courts * 2)]
          : select(seatIds, courts * 4);
        if (playing.length !== courts * 4) { valid = false; break; }
        playing.forEach(id => remaining.set(id, remaining.get(id)! - 1));
        if ([...remaining.values()].some(n => n > roundCount - index - 1)) { valid = false; break; }
        const teams = format === "mixed"
          ? formTeamsMixed(playing.slice(0, courts * 2), playing.slice(courts * 2), stats, rng)
          : formTeams(playing, stats, rng);
        const matches: CoreMatch[] = assignCourts(pairOpponents(teams, stats, rng), stats, numCourts, rng)
          .map(({ pairing, courtNo }) => ({ round_no: round, court_no: courtNo,
            a1: pairing.teamA[0], a2: pairing.teamA[1], b1: pairing.teamB[0], b2: pairing.teamB[1], is_bye: false }));
        const playingSet = new Set(playing);
        seatIds.filter(id => !playingSet.has(id)).forEach((id, bye) => matches.push({
          round_no: round, court_no: numCourts + bye + 1, a1: id, a2: null, b1: null, b2: null, is_bye: true,
        }));
        generated.push(...matches);
        matches.forEach(match => applyMatchToStats(match, stats));
      }
      if (!valid || [...remaining.values()].some(n => n !== 0)) continue;
      const repeats = [...stats.values()].reduce((sum, stat) => sum +
        [...stat.partnerCounts.values()].reduce((count, n) => count + Math.max(0, n - 1), 0), 0);
      if (repeats < bestRepeats) { best = generated; bestRepeats = repeats; }
      if (repeats === 0) break;
    }
    if (best) return best;
  }
  throw new Error("Unable to schedule the exact game totals. Adjust the roster or game target.");
}

/**
 * Generate matches for rounds [startFromRound, totalRounds] over the supplied
 * seat ids, folding `frozenMatches` into the fairness stats so partner/opponent
 * rotation continues sensibly from the played rounds. Returns ONLY the newly
 * generated rounds (frozen rounds are the caller's responsibility to keep).
 */
export function regenerateRounds(opts: RegenerateOptions): CoreMatch[] {
  const {
    seed,
    seatIds,
    numCourts,
    gamesPerPlayer,
    startFromRound,
    totalRounds,
    format = "open",
    frozenMatches = [],
    genders = new Map<SeatId, string>(),
    initialGameCredits = new Map<SeatId, number>(),
  } = opts;

  if (seatIds.length < 4) {
    throw new Error("Need at least 4 players for a doubles round robin");
  }
  if (new Set(seatIds).size !== seatIds.length) {
    throw new Error("Player identities must be unique");
  }
  if (!Number.isInteger(numCourts) || numCourts < 1) {
    throw new Error("Need at least 1 court for a doubles round robin");
  }
  if (format === "male" || format === "female") {
    const mismatches = seatIds.filter(
      (seatId) => genders.get(seatId)?.trim().toLowerCase() !== format
    ).length;
    if (mismatches > 0) {
      const label = format === "male" ? "Men's" : "Women's";
      throw new Error(
        `${label} play requires every player to be marked ${format}; ${mismatches} ${
          mismatches === 1 ? "player is" : "players are"
        } missing that eligible designation`
      );
    }
  }

  const metrics = calculateMetrics(seatIds.length, numCourts, gamesPerPlayer);
  const stats = buildPlayerStats(seatIds, frozenMatches);
  initialGameCredits.forEach((credit, seatId) => {
    const stat = stats.get(seatId);
    if (stat) stat.gamesPlayed += Math.max(0, Math.floor(credit));
  });
  const rng = new SeededRandom(seed + startFromRound);
  const generated: CoreMatch[] = [];

  // `totalRounds` is authoritative. Callers use calculateMetrics (or the
  // adjustment planner) before invoking this function. Respecting a smaller
  // value is essential when added courts compress the remaining schedule.
  const lastRound = Math.max(0, Math.floor(totalRounds));

  for (let round = startFromRound; round <= lastRound; round++) {
    const matches: CoreMatch[] = [];

    if (format === "mixed") {
      const males = seatIds.filter((id) => genders.get(id) === "male");
      const females = seatIds.filter((id) => genders.get(id) === "female");
      const mixedMatches = Math.min(
        metrics.totalCourts,
        Math.floor(males.length / 2),
        Math.floor(females.length / 2)
      );
      if (mixedMatches === 0) {
        throw new Error(
          "Mixed doubles requires at least 2 male and 2 female players"
        );
      }
      const malesNeeded = mixedMatches * 2;
      const femalesNeeded = mixedMatches * 2;
      const { playing: playingMales } = selectPlayersForRound(
        round,
        males,
        malesNeeded,
        stats,
        rng
      );
      const { playing: playingFemales } = selectPlayersForRound(
        round,
        females,
        femalesNeeded,
        stats,
        rng
      );
      const teams = formTeamsMixed(playingMales, playingFemales, stats, rng);
      const pairings = pairOpponents(teams, stats, rng);
      assignCourts(pairings, stats, metrics.totalCourts, rng).forEach(
        ({ pairing, courtNo }) => {
          matches.push({
            round_no: round,
            court_no: courtNo,
            a1: pairing.teamA[0],
            a2: pairing.teamA[1],
            b1: pairing.teamB[0],
            b2: pairing.teamB[1],
            is_bye: false,
          });
        }
      );
      const playingIds = new Set(
        pairings.flatMap(({ teamA, teamB }) => [...teamA, ...teamB])
      );
      const resting = seatIds.filter((id) => !playingIds.has(id));
      resting.forEach((seatId) => {
        matches.push({
          round_no: round,
          court_no:
            metrics.totalCourts + matches.filter((m) => m.is_bye).length + 1,
          a1: seatId,
          a2: null,
          b1: null,
          b2: null,
          is_bye: true,
        });
      });
    } else {
      const { playing, resting } = selectPlayersForRound(
        round,
        seatIds,
        metrics.onCourtPerRound,
        stats,
        rng
      );
      if (resting.length > 0) {
        const byePlayers = assignByes(
          resting,
          metrics.byesPerRound,
          stats,
          rng
        );
        byePlayers.forEach((seatId, byeIndex) => {
          matches.push({
            round_no: round,
            court_no: metrics.totalCourts + byeIndex + 1,
            a1: seatId,
            a2: null,
            b1: null,
            b2: null,
            is_bye: true,
          });
        });
      }
      const teams = formTeams(playing, stats, rng);
      const pairings = pairOpponents(teams, stats, rng);
      assignCourts(pairings, stats, metrics.totalCourts, rng).forEach(
        ({ pairing, courtNo }) => {
          matches.push({
            round_no: round,
            court_no: courtNo,
            a1: pairing.teamA[0],
            a2: pairing.teamA[1],
            b1: pairing.teamB[0],
            b2: pairing.teamB[1],
            is_bye: false,
          });
        }
      );
    }

    generated.push(...matches);
    matches.forEach((m) => applyMatchToStats(m, stats));
  }

  return generated;
}

/** Seats occupied by a match, excluding nulls. */
export function seatsOf(match: CoreMatch): SeatId[] {
  return [match.a1, match.a2, match.b1, match.b2].filter(
    (s): s is SeatId => s !== null
  );
}

/** True if the seat participates in the match (playing or on a bye). */
export function matchContains(match: CoreMatch, seatId: SeatId): boolean {
  return seatsOf(match).includes(seatId);
}
