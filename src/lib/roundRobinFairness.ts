/**
 * Round Robin Fairness Utilities
 * Tracks and calculates fairness metrics for round robin scheduling
 */

export interface PlayerStats {
  playerId: string;
  gamesPlayed: number;
  byesReceived: number;
  lastPlayedRound: number;
  partnerCounts: Map<string, number>; // playerId -> count
  opponentCounts: Map<string, number>; // playerId -> count
  courtUsage: Map<number, number>; // courtNo -> count
  lastPartner: string | null;
  lastOpponents: string[];
}

export interface RoundRobinMetrics {
  totalPlayers: number;
  totalCourts: number;
  totalRounds: number;
  matchesPerRound: number;
  onCourtPerRound: number;
  byesPerRound: number;
  targetGames: number;
  targetByes: number;
}

/**
 * Calculate the core metrics for a round robin event
 */
export function calculateMetrics(
  players: number,
  courts: number,
  rounds: number
): RoundRobinMetrics {
  const possibleMatches = Math.floor(players / 4);
  const matchesPerRound = Math.min(courts, possibleMatches);
  const onCourtPerRound = 4 * matchesPerRound;
  const byesPerRound = Math.max(0, players - onCourtPerRound);
  
  const targetGames = Math.floor((rounds * onCourtPerRound) / players);
  
  const totalByes = rounds * byesPerRound;
  const targetByes = totalByes > 0 ? Math.round(totalByes / players) : 0;

  return {
    totalPlayers: players,
    totalCourts: courts,
    totalRounds: rounds,
    matchesPerRound,
    onCourtPerRound,
    byesPerRound,
    targetGames,
    targetByes,
  };
}

/**
 * Calculate suggested rounds for desired games per player
 */
export function suggestRounds(
  players: number,
  courts: number,
  desiredGamesPerPlayer: number = 4
): number {
  const possibleMatches = Math.floor(players / 4);
  const matchesPerRound = Math.min(courts, possibleMatches);
  const onCourtPerRound = 4 * matchesPerRound;
  if (onCourtPerRound === 0) return 0;
  return Math.ceil((desiredGamesPerPlayer * players) / onCourtPerRound);
}

/**
 * Initialize player stats from completed matches
 */
export function initializePlayerStats(
  playerIds: string[],
  completedMatches: Array<{
    round_no: number;
    court_no: number;
    a1_player_id: string | null;
    a2_player_id: string | null;
    b1_player_id: string | null;
    b2_player_id: string | null;
    is_bye: boolean;
  }>
): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();

  // Initialize all players
  playerIds.forEach((id) => {
    stats.set(id, {
      playerId: id,
      gamesPlayed: 0,
      byesReceived: 0,
      lastPlayedRound: 0,
      partnerCounts: new Map(),
      opponentCounts: new Map(),
      courtUsage: new Map(),
      lastPartner: null,
      lastOpponents: [],
    });
  });

  // Process completed matches
  completedMatches.forEach((match) => {
    if (match.is_bye) {
      // Handle bye
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

    // Update stats for each player
    players.forEach((playerId) => {
      // Tolerate ids present in completed history but absent from the roster
      // (e.g. a participant withdrawn/removed after playing earlier rounds).
      // Previously this did `stats.get(id)!` and threw on any such id.
      const stat = stats.get(playerId);
      if (!stat) return;
      stat.gamesPlayed++;
      stat.lastPlayedRound = match.round_no;

      // Update court usage
      stat.courtUsage.set(
        match.court_no,
        (stat.courtUsage.get(match.court_no) || 0) + 1
      );

      // Determine partner and opponents
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

      // Update partner counts
      stat.partnerCounts.set(partner, (stat.partnerCounts.get(partner) || 0) + 1);
      stat.lastPartner = partner;

      // Update opponent counts
      opponents.forEach((opp) => {
        stat.opponentCounts.set(opp, (stat.opponentCounts.get(opp) || 0) + 1);
      });
      stat.lastOpponents = opponents;
    });
  });

  return stats;
}

/**
 * Calculate rest gap (rounds since last played)
 */
export function calculateRestGap(currentRound: number, lastPlayedRound: number): number {
  return currentRound - lastPlayedRound;
}

/**
 * Calculate pair penalty for partnering two players
 */
export function calculatePairPenalty(
  p1Stats: PlayerStats,
  p2Stats: PlayerStats,
  p2Id: string
): number {
  const partnerCount = p1Stats.partnerCounts.get(p2Id) || 0;
  const teamedLast = p1Stats.lastPartner === p2Id ? 1 : 0;
  
  return 3 * (partnerCount > 0 ? 1 : 0) + 2 * teamedLast;
}

/**
 * Calculate opponent penalty for two teams playing each other
 */
export function calculateOpponentPenalty(
  team1: [string, string],
  team2: [string, string],
  stats: Map<string, PlayerStats>
): number {
  let totalMeetings = 0;
  let metLastRound = 0;

  // Check all cross-team pairings
  team1.forEach((p1) => {
    team2.forEach((p2) => {
      const p1Stats = stats.get(p1)!;
      const meetings = p1Stats.opponentCounts.get(p2) || 0;
      totalMeetings += meetings;

      if (p1Stats.lastOpponents.includes(p2)) {
        metLastRound = 1;
      }
    });
  });

  return 2 * (totalMeetings > 0 ? 1 : 0) + metLastRound;
}

/**
 * Seeded random number generator for deterministic scheduling
 */
export class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    // Convert string to numeric seed
    this.seed = seed.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
  }

  /**
   * Generate next random number (0 to 1)
   */
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  /**
   * Shuffle array in place
   */
  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
