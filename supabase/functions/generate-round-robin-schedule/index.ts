import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:8080",
  "https://pulse.lovable.app",
  "https://ryxklkayezjnwwunuphn.supabase.co"
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface ScheduleRequest {
  event_id: string;
  player_ids: string[];
  num_courts: number;
  num_rounds: number;
  regenerate_from_round?: number;
}

interface PlayerStats {
  playerId: string;
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

// Calculate metrics
function calculateMetrics(players: number, courts: number, rounds: number) {
  const matchesPerRound = Math.min(courts, Math.floor(players / 4));
  const onCourtPerRound = 4 * matchesPerRound;
  const byesPerRound = Math.max(0, players - onCourtPerRound);
  const targetGames = Math.floor((rounds * onCourtPerRound) / players);
  const totalByes = rounds * byesPerRound;
  const targetByes = totalByes > 0 ? Math.round(totalByes / players) : 0;

  return {
    matchesPerRound,
    onCourtPerRound,
    byesPerRound,
    targetGames,
    targetByes,
    totalCourts: courts,
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
  numRounds: number,
  completedMatches: ScheduleMatch[] = [],
  startFromRound: number = 1
): ScheduleMatch[] {
  if (playerIds.length < 4) {
    throw new Error('Need at least 4 players for doubles round robin');
  }

  const metrics = calculateMetrics(playerIds.length, numCourts, numRounds);
  const stats = initializePlayerStats(playerIds, completedMatches);
  const rng = new SeededRandom(eventId + startFromRound);
  const schedule: ScheduleMatch[] = [...completedMatches];

  for (let round = startFromRound; round <= numRounds; round++) {
    const { playing, resting } = selectPlayersForRound(
      round,
      playerIds,
      metrics.onCourtPerRound,
      stats,
      rng
    );

    const matches: ScheduleMatch[] = [];

    // Assign byes
    if (resting.length > 0) {
      const byePlayers = assignByes(resting, metrics.byesPerRound, stats, rng);
      byePlayers.forEach((playerId) => {
        matches.push({
          round_no: round,
          court_no: 0,
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

    schedule.push(...matches);

    // Update stats
    matches.forEach((match) => {
      updateStatsWithMatch(match, stats);
    });
  }

  return schedule;
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);
  
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
      num_rounds,
      regenerate_from_round 
    }: ScheduleRequest = await req.json();

    // Verify user is organizer
    const { data: event, error: eventError } = await supabase
      .from('round_robin_events')
      .select('organizer_id')
      .eq('id', event_id)
      .single();

    if (eventError || event.organizer_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to modify this event' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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

    // Generate schedule
    const schedule = generateRoundRobinSchedule(
      event_id,
      player_ids,
      num_courts,
      num_rounds,
      completedMatches,
      startFromRound
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
