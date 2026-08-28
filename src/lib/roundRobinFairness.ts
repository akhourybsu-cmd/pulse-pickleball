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
