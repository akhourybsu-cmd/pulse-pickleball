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
      return ((acc << 5) - acc) + char.charCodeAt(0);
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
  rounds: number;
}

/** Mirrors the edge function's metric calculation. */
export function calculateMetrics(
  players: number,
  courts: number,
  gamesPerPlayer: number,
): ScheduleMetrics {
  const maxPossibleMatches = Math.floor(players / 4);
  const matchesPerRound = Math.min(courts, maxPossibleMatches);
  const onCourtPerRound = 4 * matchesPerRound;
  const byesPerRound = Math.max(0, players - onCourtPerRound);

  const gamesPerRoundPerPlayer = onCourtPerRound / players;
  const rounds = gamesPerRoundPerPlayer > 0
    ? Math.ceil(gamesPerPlayer / gamesPerRoundPerPlayer)
    : 0;

  const totalByes = rounds * byesPerRound;
  const targetByes = totalByes > 0 ? Math.round(totalByes / players) : 0;

  return {
    matchesPerRound,
    onCourtPerRound,
    byesPerRound,
    targetGames: gamesPerPlayer,
    targetByes,
    totalCourts: courts,
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

function applyMatchToStats(match: CoreMatch, stats: Map<SeatId, PlayerStats>): void {
  if (match.is_bye) {
    const byePlayer = match.a1;
    if (byePlayer && stats.has(byePlayer)) {
      stats.get(byePlayer)!.byesReceived++;
    }
    return;
  }

  const players = [match.a1, match.a2, match.b1, match.b2].filter(
    (id): id is SeatId => id !== null,
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
    stat.courtUsage.set(match.court_no, (stat.courtUsage.get(match.court_no) || 0) + 1);

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
  playedMatches: CoreMatch[] = [],
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
  return 3 * (partnerCount > 0 ? 1 : 0) + 2 * teamedLast;
}

function opponentPenalty(
  team1: [SeatId, SeatId],
  team2: [SeatId, SeatId],
  stats: Map<SeatId, PlayerStats>,
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
  return 2 * (totalMeetings > 0 ? 1 : 0) + metLastRound;
}

function selectPlayersForRound(
  roundNo: number,
  allPlayers: SeatId[],
  onCourt: number,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom,
): { playing: SeatId[]; resting: SeatId[] } {
  const sorted = [...allPlayers].sort((a, b) => {
    const aS = stats.get(a)!;
    const bS = stats.get(b)!;
    if (aS.gamesPlayed !== bS.gamesPlayed) return aS.gamesPlayed - bS.gamesPlayed;
    const aRest = roundNo - aS.lastPlayedRound;
    const bRest = roundNo - bS.lastPlayedRound;
    if (aRest !== bRest) return bRest - aRest;
    return rng.next() - 0.5;
  });
  return { playing: sorted.slice(0, onCourt), resting: sorted.slice(onCourt) };
}

function assignByes(
  resting: SeatId[],
  byesNeeded: number,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom,
): SeatId[] {
  const sorted = [...resting].sort((a, b) => {
    const aS = stats.get(a)!;
    const bS = stats.get(b)!;
    if (aS.gamesPlayed !== bS.gamesPlayed) return bS.gamesPlayed - aS.gamesPlayed;
    if (aS.lastPlayedRound !== bS.lastPlayedRound) return bS.lastPlayedRound - aS.lastPlayedRound;
    if (aS.byesReceived !== bS.byesReceived) return aS.byesReceived - bS.byesReceived;
    return rng.next() - 0.5;
  });
  return sorted.slice(0, byesNeeded);
}

function formTeams(
  players: SeatId[],
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom,
): Array<[SeatId, SeatId]> {
  const available = new Set(players);
  const teams: Array<[SeatId, SeatId]> = [];
  while (available.size >= 2) {
    const p1 = Array.from(available)[0];
    available.delete(p1);
    let best: SeatId | null = null;
    let bestPenalty = Infinity;
    Array.from(available).forEach((p2) => {
      const penalty = pairPenalty(stats.get(p1)!, p2);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = p2;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        best = p2;
      }
    });
    if (best) {
      available.delete(best);
      teams.push([p1, best]);
    }
  }
  return teams;
}

function formTeamsMixed(
  males: SeatId[],
  females: SeatId[],
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom,
): Array<[SeatId, SeatId]> {
  const availableMales = new Set(males);
  const availableFemales = new Set(females);
  const teams: Array<[SeatId, SeatId]> = [];
  while (availableMales.size >= 1 && availableFemales.size >= 1) {
    const male = Array.from(availableMales)[0];
    availableMales.delete(male);
    let best: SeatId | null = null;
    let bestPenalty = Infinity;
    Array.from(availableFemales).forEach((female) => {
      const penalty = pairPenalty(stats.get(male)!, female);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = female;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        best = female;
      }
    });
    if (best) {
      availableFemales.delete(best);
      teams.push([male, best]);
    }
  }
  return teams;
}

function pairOpponents(
  teams: Array<[SeatId, SeatId]>,
  stats: Map<SeatId, PlayerStats>,
  rng: SeededRandom,
): Array<{ teamA: [SeatId, SeatId]; teamB: [SeatId, SeatId] }> {
  const available = new Set(teams);
  const pairings: Array<{ teamA: [SeatId, SeatId]; teamB: [SeatId, SeatId] }> = [];
  while (available.size >= 2) {
    const teamA = Array.from(available)[0];
    available.delete(teamA);
    let best: [SeatId, SeatId] | null = null;
    let bestPenalty = Infinity;
    Array.from(available).forEach((teamB) => {
      const penalty = opponentPenalty(teamA, teamB, stats);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = teamB;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        best = teamB;
      }
    });
    if (best) {
      available.delete(best);
      pairings.push({ teamA, teamB: best });
    }
  }
  return pairings;
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
  } = opts;

  if (seatIds.length < 4) {
    throw new Error("Need at least 4 players for a doubles round robin");
  }

  const metrics = calculateMetrics(seatIds.length, numCourts, gamesPerPlayer);
  const stats = buildPlayerStats(seatIds, frozenMatches);
  const rng = new SeededRandom(seed + startFromRound);
  const generated: CoreMatch[] = [];

  const lastRound = Math.max(totalRounds, metrics.rounds >= startFromRound ? metrics.rounds : totalRounds);

  for (let round = startFromRound; round <= lastRound; round++) {
    const matches: CoreMatch[] = [];

    if (format === "mixed") {
      const males = seatIds.filter((id) => genders.get(id) === "male");
      const females = seatIds.filter((id) => genders.get(id) === "female");
      const malesNeeded = Math.min(males.length, metrics.totalCourts * 2);
      const femalesNeeded = Math.min(females.length, metrics.totalCourts * 2);
      const { playing: playingMales } = selectPlayersForRound(round, males, malesNeeded, stats, rng);
      const { playing: playingFemales } = selectPlayersForRound(round, females, femalesNeeded, stats, rng);
      const teams = formTeamsMixed(playingMales, playingFemales, stats, rng);
      const pairings = pairOpponents(teams, stats, rng);
      pairings.forEach((pairing, index) => {
        matches.push({
          round_no: round,
          court_no: (index % metrics.totalCourts) + 1,
          a1: pairing.teamA[0],
          a2: pairing.teamA[1],
          b1: pairing.teamB[0],
          b2: pairing.teamB[1],
          is_bye: false,
        });
      });
      const playingIds = new Set([...playingMales, ...playingFemales]);
      const resting = seatIds.filter((id) => !playingIds.has(id));
      resting.forEach((seatId) => {
        matches.push({
          round_no: round,
          court_no: metrics.totalCourts + matches.filter((m) => m.is_bye).length + 1,
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
        rng,
      );
      if (resting.length > 0) {
        const byePlayers = assignByes(resting, metrics.byesPerRound, stats, rng);
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
      pairings.forEach((pairing, index) => {
        matches.push({
          round_no: round,
          court_no: (index % metrics.totalCourts) + 1,
          a1: pairing.teamA[0],
          a2: pairing.teamA[1],
          b1: pairing.teamB[0],
          b2: pairing.teamB[1],
          is_bye: false,
        });
      });
    }

    generated.push(...matches);
    matches.forEach((m) => applyMatchToStats(m, stats));
  }

  return generated;
}

/** Seats occupied by a match, excluding nulls. */
export function seatsOf(match: CoreMatch): SeatId[] {
  return [match.a1, match.a2, match.b1, match.b2].filter((s): s is SeatId => s !== null);
}

/** True if the seat participates in the match (playing or on a bye). */
export function matchContains(match: CoreMatch, seatId: SeatId): boolean {
  return seatsOf(match).includes(seatId);
}
