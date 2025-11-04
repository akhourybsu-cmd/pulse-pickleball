/**
 * Round Robin Scheduler
 * Implements deterministic, fair scheduling algorithm for doubles round robin events
 */

import {
  calculateMetrics,
  initializePlayerStats,
  calculateRestGap,
  calculatePairPenalty,
  calculateOpponentPenalty,
  SeededRandom,
  type PlayerStats,
  type RoundRobinMetrics,
} from './roundRobinFairness';

export interface ScheduleMatch {
  round_no: number;
  court_no: number;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  is_bye: boolean;
}

export interface ScheduleInput {
  eventId: string;
  playerIds: string[];
  numCourts: number;
  numRounds: number;
  completedMatches?: ScheduleMatch[];
  startFromRound?: number; // For regeneration
  format?: 'open' | 'mixed' | 'male' | 'female';
  playerGenders?: Map<string, string>;
}

/**
 * Main scheduler function - generates fair round robin schedule
 */
export function generateRoundRobinSchedule(input: ScheduleInput): ScheduleMatch[] {
  const {
    eventId,
    playerIds,
    numCourts,
    numRounds,
    completedMatches = [],
    startFromRound = 1,
    format = 'open',
    playerGenders = new Map(),
  } = input;

  if (playerIds.length < 4) {
    throw new Error('Need at least 4 players for doubles round robin');
  }

  const metrics = calculateMetrics(playerIds.length, numCourts, numRounds);
  const stats = initializePlayerStats(playerIds, completedMatches);
  const rng = new SeededRandom(eventId);
  const schedule: ScheduleMatch[] = [...completedMatches];

  // Generate each round
  for (let round = startFromRound; round <= numRounds; round++) {
    let roundMatches: ScheduleMatch[] = [];

    if (format === 'mixed') {
      // Mixed format: separate males and females
      const males = playerIds.filter(id => playerGenders.get(id) === 'male');
      const females = playerIds.filter(id => playerGenders.get(id) === 'female');

      // Select players for round (balanced by gender)
      const malesNeeded = Math.min(males.length, metrics.totalCourts * 2);
      const femalesNeeded = Math.min(females.length, metrics.totalCourts * 2);

      const { playing: playingMales } = selectPlayersForRound(
        round,
        males,
        metrics,
        stats,
        rng
      );

      const { playing: playingFemales } = selectPlayersForRound(
        round,
        females,
        metrics,
        stats,
        rng
      );

      // Slice to needed count
      const selectedMales = playingMales.slice(0, malesNeeded);
      const selectedFemales = playingFemales.slice(0, femalesNeeded);

      // Form mixed teams (1 male + 1 female)
      const teams = formTeamsMixed(selectedMales, selectedFemales, stats, rng);

      // Pair opponents
      const pairings = pairOpponents(teams, stats, rng);

      // Assign courts
      const courtMatches = assignCourts(pairings, round, metrics, stats, rng);
      roundMatches.push(...courtMatches);

      // Add byes for remaining players
      const allPlayingIds = new Set([...selectedMales, ...selectedFemales]);
      const restingMales = males.filter(id => !allPlayingIds.has(id));
      const restingFemales = females.filter(id => !allPlayingIds.has(id));

      [...restingMales, ...restingFemales].forEach((playerId) => {
        roundMatches.push({
          round_no: round,
          court_no: 0,
          a1_player_id: playerId,
          a2_player_id: null,
          b1_player_id: null,
          b2_player_id: null,
          is_bye: true,
        });
      });
    } else {
      // Open/Male/Female format: use standard logic
      const roundData = generateRound(round, playerIds, metrics, stats, rng);
      roundMatches = roundData;
    }

    schedule.push(...roundMatches);

    // Update stats with this round's matches
    roundMatches.forEach((match) => {
      updateStatsWithMatch(match, stats);
    });
  }

  return schedule;
}

/**
 * Generate a single round
 */
function generateRound(
  roundNo: number,
  allPlayers: string[],
  metrics: RoundRobinMetrics,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): ScheduleMatch[] {
  // Step 1: Select who plays and who rests
  const { playing, resting } = selectPlayersForRound(
    roundNo,
    allPlayers,
    metrics,
    stats,
    rng
  );

  // Step 2: If there are byes, assign them
  const matches: ScheduleMatch[] = [];
  if (resting.length > 0) {
    const byePlayers = assignByes(resting, metrics.byesPerRound, stats, rng);
    byePlayers.forEach((playerId) => {
      matches.push({
        round_no: roundNo,
        court_no: 0,
        a1_player_id: playerId,
        a2_player_id: null,
        b1_player_id: null,
        b2_player_id: null,
        is_bye: true,
      });
    });
  }

  // Step 3: Form teams from playing players
  const teams = formTeams(playing, stats, rng);

  // Step 4: Pair teams as opponents
  const pairings = pairOpponents(teams, stats, rng);

  // Step 5: Assign courts
  const courtMatches = assignCourts(pairings, roundNo, metrics, stats, rng);

  matches.push(...courtMatches);
  return matches;
}

/**
 * Select who plays this round vs who rests
 */
function selectPlayersForRound(
  roundNo: number,
  allPlayers: string[],
  metrics: RoundRobinMetrics,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): { playing: string[]; resting: string[] } {
  // Sort by priority: fewest games, longest rest, then random
  const sorted = [...allPlayers].sort((a, b) => {
    const aStats = stats.get(a)!;
    const bStats = stats.get(b)!;

    // 1. Fewest games played
    if (aStats.gamesPlayed !== bStats.gamesPlayed) {
      return aStats.gamesPlayed - bStats.gamesPlayed;
    }

    // 2. Longest rest gap
    const aRest = calculateRestGap(roundNo, aStats.lastPlayedRound);
    const bRest = calculateRestGap(roundNo, bStats.lastPlayedRound);
    if (aRest !== bRest) {
      return bRest - aRest; // Longer rest = higher priority
    }

    // 3. Random (deterministic)
    return rng.next() - 0.5;
  });

  const playing = sorted.slice(0, metrics.onCourtPerRound);
  const resting = sorted.slice(metrics.onCourtPerRound);

  return { playing, resting };
}

/**
 * Assign byes to resting players
 */
function assignByes(
  restingPlayers: string[],
  byesNeeded: number,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): string[] {
  // Sort by: most games over target, shortest rest, fewest byes, then random
  const sorted = [...restingPlayers].sort((a, b) => {
    const aStats = stats.get(a)!;
    const bStats = stats.get(b)!;

    // 1. Most games (they need a break)
    if (aStats.gamesPlayed !== bStats.gamesPlayed) {
      return bStats.gamesPlayed - aStats.gamesPlayed;
    }

    // 2. Shortest rest (just played)
    const aRest = aStats.lastPlayedRound;
    const bRest = bStats.lastPlayedRound;
    if (aRest !== bRest) {
      return bRest - aRest;
    }

    // 3. Fewest byes received
    if (aStats.byesReceived !== bStats.byesReceived) {
      return aStats.byesReceived - bStats.byesReceived;
    }

    // 4. Random
    return rng.next() - 0.5;
  });

  return sorted.slice(0, byesNeeded);
}

/**
 * Form teams for Mixed format (1 male + 1 female)
 */
function formTeamsMixed(
  males: string[],
  females: string[],
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): Array<[string, string]> {
  const availableMales = new Set(males);
  const availableFemales = new Set(females);
  const teams: Array<[string, string]> = [];

  while (availableMales.size >= 1 && availableFemales.size >= 1) {
    const male = Array.from(availableMales)[0];
    availableMales.delete(male);

    let bestPartner: string | null = null;
    let bestPenalty = Infinity;

    Array.from(availableFemales).forEach((female) => {
      const penalty = calculatePairPenalty(stats.get(male)!, stats.get(female)!, female);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPartner = female;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        bestPartner = female;
      }
    });

    if (bestPartner) {
      availableFemales.delete(bestPartner);
      teams.push([male, bestPartner]);
    }
  }

  return teams;
}

/**
 * Form teams from playing players
 */
function formTeams(
  players: string[],
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): Array<[string, string]> {
  const available = new Set(players);
  const teams: Array<[string, string]> = [];

  while (available.size >= 2) {
    // Pick first available player
    const p1 = Array.from(available)[0];
    available.delete(p1);

    // Find best partner (minimize pair penalty)
    let bestPartner: string | null = null;
    let bestPenalty = Infinity;

    Array.from(available).forEach((p2) => {
      const penalty = calculatePairPenalty(stats.get(p1)!, stats.get(p2)!, p2);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPartner = p2;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        // Random tiebreak
        bestPartner = p2;
      }
    });

    if (bestPartner) {
      available.delete(bestPartner);
      teams.push([p1, bestPartner]);
    }
  }

  return teams;
}

/**
 * Pair teams as opponents
 */
function pairOpponents(
  teams: Array<[string, string]>,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): Array<{ teamA: [string, string]; teamB: [string, string] }> {
  const available = new Set(teams);
  const pairings: Array<{ teamA: [string, string]; teamB: [string, string] }> = [];

  while (available.size >= 2) {
    const teamA = Array.from(available)[0];
    available.delete(teamA);

    // Find best opponent team (minimize opponent penalty)
    let bestOpponent: [string, string] | null = null;
    let bestPenalty = Infinity;

    Array.from(available).forEach((teamB) => {
      const penalty = calculateOpponentPenalty(teamA, teamB, stats);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestOpponent = teamB;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
        bestOpponent = teamB;
      }
    });

    if (bestOpponent) {
      available.delete(bestOpponent);
      pairings.push({ teamA, teamB: bestOpponent });
    }
  }

  return pairings;
}

/**
 * Assign court numbers to pairings
 */
function assignCourts(
  pairings: Array<{ teamA: [string, string]; teamB: [string, string] }>,
  roundNo: number,
  metrics: RoundRobinMetrics,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): ScheduleMatch[] {
  // Assign courts 1 to C to balance court usage
  const matches: ScheduleMatch[] = [];

  pairings.forEach((pairing, index) => {
    const courtNo = (index % metrics.totalCourts) + 1;
    matches.push({
      round_no: roundNo,
      court_no: courtNo,
      a1_player_id: pairing.teamA[0],
      a2_player_id: pairing.teamA[1],
      b1_player_id: pairing.teamB[0],
      b2_player_id: pairing.teamB[1],
      is_bye: false,
    });
  });

  return matches;
}

/**
 * Update player stats after a match
 */
function updateStatsWithMatch(match: ScheduleMatch, stats: Map<string, PlayerStats>): void {
  if (match.is_bye) {
    const byePlayer = match.a1_player_id;
    if (byePlayer && stats.has(byePlayer)) {
      stats.get(byePlayer)!.byesReceived++;
    }
    return;
  }

  const players = [
    match.a1_player_id,
    match.a2_player_id,
    match.b1_player_id,
    match.b2_player_id,
  ].filter((id): id is string => id !== null);

  if (players.length !== 4) return;

  const [a1, a2, b1, b2] = players;
  const teamA = [a1, a2];
  const teamB = [b1, b2];

  players.forEach((playerId) => {
    const stat = stats.get(playerId)!;
    stat.gamesPlayed++;
    stat.lastPlayedRound = match.round_no;

    stat.courtUsage.set(
      match.court_no,
      (stat.courtUsage.get(match.court_no) || 0) + 1
    );

    let partner: string;
    let opponents: string[];

    if (playerId === a1) {
      partner = a2;
      opponents = teamB;
    } else if (playerId === a2) {
      partner = a1;
      opponents = teamB;
    } else if (playerId === b1) {
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
