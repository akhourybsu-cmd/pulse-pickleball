import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Participant {
  player_id?: string | null;
  guest_id?: string | null;
}

interface ScheduleRequest {
  event_id: string;
  // Back-compat: callers may still send player_ids only (all registered players).
  player_ids?: string[];
  // Preferred: mixed list of registered players and guests.
  participants?: Participant[];
  num_courts: number;
  num_rounds: number;
  games_per_player: number;
  regenerate_from_round?: number;
  format?: 'open' | 'mixed' | 'male' | 'female';
}

interface PlayerStats {
  playerId: string; // synthetic seat id: "p:<uuid>" or "g:<uuid>"
  gamesPlayed: number;
  byesReceived: number;
  lastPlayedRound: number;
  partnerCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  courtUsage: Map<number, number>;
  lastPartner: string | null;
  lastOpponents: string[];
}

interface ScheduleMatch {
  round_no: number;
  court_no: number;
  // Synthetic seat ids during generation; split into player/guest at insert time.
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  is_bye: boolean;
}

// Seeded random number generator for deterministic scheduling
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = seed.split('').reduce((acc, char) => {
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

// Calculate metrics based on games per player
function calculateMetrics(players: number, courts: number, gamesPerPlayer: number) {
  const maxPossibleMatches = Math.floor(players / 4); // Max matches we can run with available players
  const matchesPerRound = Math.min(courts, maxPossibleMatches); // Limited by courts or players
  const onCourtPerRound = 4 * matchesPerRound;
  const byesPerRound = Math.max(0, players - onCourtPerRound);
  
  // Calculate games per round per player
  // If everyone plays: gamesPerRoundPerPlayer = 1
  // If there are byes: gamesPerRoundPerPlayer = onCourtPerRound / players
  const gamesPerRoundPerPlayer = onCourtPerRound / players;
  
  // Calculate rounds needed for target games per player
  const rounds = Math.ceil(gamesPerPlayer / gamesPerRoundPerPlayer);
  
  const targetGames = gamesPerPlayer;
  const totalByes = rounds * byesPerRound;
  const targetByes = totalByes > 0 ? Math.round(totalByes / players) : 0;

  return {
    matchesPerRound,
    onCourtPerRound,
    byesPerRound,
    targetGames,
    targetByes,
    totalCourts: courts,
    rounds,
  };
}

// Initialize player stats
function initializePlayerStats(
  playerIds: string[],
  completedMatches: ScheduleMatch[]
): Map<string, PlayerStats> {
  const stats = new Map<string, PlayerStats>();

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

  completedMatches.forEach((match) => {
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
  });

  return stats;
}

// Calculate pair penalty
function calculatePairPenalty(
  p1Stats: PlayerStats,
  p2Stats: PlayerStats,
  p2Id: string
): number {
  const partnerCount = p1Stats.partnerCounts.get(p2Id) || 0;
  const teamedLast = p1Stats.lastPartner === p2Id ? 1 : 0;
  return 3 * (partnerCount > 0 ? 1 : 0) + 2 * teamedLast;
}

// Calculate opponent penalty
function calculateOpponentPenalty(
  team1: [string, string],
  team2: [string, string],
  stats: Map<string, PlayerStats>
): number {
  let totalMeetings = 0;
  let metLastRound = 0;

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

// Select players for round
function selectPlayersForRound(
  roundNo: number,
  allPlayers: string[],
  onCourtPerRound: number,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): { playing: string[]; resting: string[] } {
  const sorted = [...allPlayers].sort((a, b) => {
    const aStats = stats.get(a)!;
    const bStats = stats.get(b)!;

    if (aStats.gamesPlayed !== bStats.gamesPlayed) {
      return aStats.gamesPlayed - bStats.gamesPlayed;
    }

    const aRest = roundNo - aStats.lastPlayedRound;
    const bRest = roundNo - bStats.lastPlayedRound;
    if (aRest !== bRest) {
      return bRest - aRest;
    }

    return rng.next() - 0.5;
  });

  const playing = sorted.slice(0, onCourtPerRound);
  const resting = sorted.slice(onCourtPerRound);

  return { playing, resting };
}

// Assign byes
function assignByes(
  restingPlayers: string[],
  byesNeeded: number,
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): string[] {
  const sorted = [...restingPlayers].sort((a, b) => {
    const aStats = stats.get(a)!;
    const bStats = stats.get(b)!;

    if (aStats.gamesPlayed !== bStats.gamesPlayed) {
      return bStats.gamesPlayed - aStats.gamesPlayed;
    }

    if (aStats.lastPlayedRound !== bStats.lastPlayedRound) {
      return bStats.lastPlayedRound - aStats.lastPlayedRound;
    }

    if (aStats.byesReceived !== bStats.byesReceived) {
      return aStats.byesReceived - bStats.byesReceived;
    }

    return rng.next() - 0.5;
  });

  return sorted.slice(0, byesNeeded);
}

// Form teams for Mixed format (1 male + 1 female)
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

// Form teams
function formTeams(
  players: string[],
  stats: Map<string, PlayerStats>,
  rng: SeededRandom
): Array<[string, string]> {
  const available = new Set(players);
  const teams: Array<[string, string]> = [];

  while (available.size >= 2) {
    const p1 = Array.from(available)[0];
    available.delete(p1);

    let bestPartner: string | null = null;
    let bestPenalty = Infinity;

    Array.from(available).forEach((p2) => {
      const penalty = calculatePairPenalty(stats.get(p1)!, stats.get(p2)!, p2);
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestPartner = p2;
      } else if (penalty === bestPenalty && rng.next() < 0.5) {
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

// Pair opponents
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

// Update stats with match
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

// Generate complete schedule
function generateRoundRobinSchedule(
  eventId: string,
  playerIds: string[],
  numCourts: number,
  gamesPerPlayer: number,
  completedMatches: ScheduleMatch[] = [],
  startFromRound: number = 1,
  format: string = 'open',
  playerGenders: Map<string, string> = new Map()
): ScheduleMatch[] {
  if (playerIds.length < 4) {
    throw new Error('Need at least 4 players for doubles round robin');
  }

  const metrics = calculateMetrics(playerIds.length, numCourts, gamesPerPlayer);
  const stats = initializePlayerStats(playerIds, completedMatches);
  const rng = new SeededRandom(eventId + startFromRound);
  const schedule: ScheduleMatch[] = [...completedMatches];

  for (let round = startFromRound; round <= metrics.rounds; round++) {
    let matches: ScheduleMatch[] = [];

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

      // Form mixed teams (1 male + 1 female)
      const teams = formTeamsMixed(playingMales, playingFemales, stats, rng);

      // Pair opponents
      const pairings = pairOpponents(teams, stats, rng);

      // Assign courts
      pairings.forEach((pairing, index) => {
        const courtNo = (index % metrics.totalCourts) + 1;
        matches.push({
          round_no: round,
          court_no: courtNo,
          a1_player_id: pairing.teamA[0],
          a2_player_id: pairing.teamA[1],
          b1_player_id: pairing.teamB[0],
          b2_player_id: pairing.teamB[1],
          is_bye: false,
        });
      });

      // Add byes for any remaining players
      const allPlayingIds = new Set([...playingMales, ...playingFemales]);
      const restingMales = males.filter(id => !allPlayingIds.has(id));
      const restingFemales = females.filter(id => !allPlayingIds.has(id));
      
      const maleByesNeeded = Math.min(restingMales.length, Math.floor(restingMales.length / 2));
      const femaleByesNeeded = Math.min(restingFemales.length, Math.floor(restingFemales.length / 2));

      if (maleByesNeeded > 0) {
        const maleByePlayers = assignByes(restingMales, maleByesNeeded, stats, rng);
        maleByePlayers.forEach((playerId, index) => {
          matches.push({
            round_no: round,
            court_no: metrics.totalCourts + matches.filter(m => m.is_bye).length + 1,
            a1_player_id: playerId,
            a2_player_id: null,
            b1_player_id: null,
            b2_player_id: null,
            is_bye: true,
          });
        });
      }

      if (femaleByesNeeded > 0) {
        const femaleByePlayers = assignByes(restingFemales, femaleByesNeeded, stats, rng);
        femaleByePlayers.forEach((playerId, index) => {
          matches.push({
            round_no: round,
            court_no: metrics.totalCourts + matches.filter(m => m.is_bye).length + 1,
            a1_player_id: playerId,
            a2_player_id: null,
            b1_player_id: null,
            b2_player_id: null,
            is_bye: true,
          });
        });
      }
    } else {
      // Open/Male/Female format: use standard logic
      const { playing, resting } = selectPlayersForRound(
        round,
        playerIds,
        metrics.onCourtPerRound,
        stats,
        rng
      );

      // Assign byes
      if (resting.length > 0) {
        const byePlayers = assignByes(resting, metrics.byesPerRound, stats, rng);
        byePlayers.forEach((playerId, byeIndex) => {
          const byeCourtNo = metrics.totalCourts + byeIndex + 1;
          matches.push({
            round_no: round,
            court_no: byeCourtNo,
            a1_player_id: playerId,
            a2_player_id: null,
            b1_player_id: null,
            b2_player_id: null,
            is_bye: true,
          });
        });
      }

      // Form teams
      const teams = formTeams(playing, stats, rng);

      // Pair opponents
      const pairings = pairOpponents(teams, stats, rng);

      // Assign courts
      pairings.forEach((pairing, index) => {
        const courtNo = (index % metrics.totalCourts) + 1;
        matches.push({
          round_no: round,
          court_no: courtNo,
          a1_player_id: pairing.teamA[0],
          a2_player_id: pairing.teamA[1],
          b1_player_id: pairing.teamB[0],
          b2_player_id: pairing.teamB[1],
          is_bye: false,
        });
      });
    }

    schedule.push(...matches);

    // Update stats
    matches.forEach((match) => {
      updateStatsWithMatch(match, stats);
    });
  }

  return schedule;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      event_id, 
      player_ids, 
      num_courts, 
      num_rounds, // Now calculated, but kept for backwards compatibility
      games_per_player,
      regenerate_from_round,
      format 
    }: ScheduleRequest = await req.json();

    // Verify user is organizer and get event format
    const { data: event, error: eventError } = await supabase
      .from('round_robin_events')
      .select('organizer_id, format')
      .eq('id', event_id)
      .single();

    if (eventError || event.organizer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to modify this event' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const eventFormat = format || event.format || 'open';

    // Fetch player genders if format requires it
    const playerGenders = new Map<string, string>();
    if (eventFormat === 'mixed' || eventFormat === 'male' || eventFormat === 'female') {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, gender')
        .in('id', player_ids);

      if (profiles) {
        profiles.forEach(p => {
          if (p.gender) {
            playerGenders.set(p.id, p.gender);
          }
        });
      }
    }

    let completedMatches: ScheduleMatch[] = [];
    let startFromRound = 1;

    // If regenerating, keep completed rounds
    if (regenerate_from_round && regenerate_from_round > 1) {
      const { data: existing } = await supabase
        .from('round_robin_schedule')
        .select('*')
        .eq('event_id', event_id)
        .lt('round_no', regenerate_from_round);

      if (existing) {
        completedMatches = existing as ScheduleMatch[];
      }
      startFromRound = regenerate_from_round;

      // Delete future rounds
      await supabase
        .from('round_robin_schedule')
        .delete()
        .eq('event_id', event_id)
        .gte('round_no', regenerate_from_round);
    } else {
      // Full regeneration - delete all
      await supabase
        .from('round_robin_schedule')
        .delete()
        .eq('event_id', event_id);
    }

    // Generate schedule using games per player
    const schedule = generateRoundRobinSchedule(
      event_id,
      player_ids,
      num_courts,
      games_per_player || num_rounds, // Fallback to num_rounds for backwards compat
      completedMatches,
      startFromRound,
      eventFormat,
      playerGenders
    );

    // Insert new rounds only
    const newRounds = schedule.filter(m => m.round_no >= startFromRound);
    const { error: insertError } = await supabase
      .from('round_robin_schedule')
      .insert(newRounds.map(m => ({
        event_id,
        ...m,
      })));

    if (insertError) {
      console.error('Schedule insert failed:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        matches_created: newRounds.length,
        total_matches: schedule.length 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Schedule generation failed:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Failed to generate schedule' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
