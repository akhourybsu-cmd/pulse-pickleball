import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRequest {
  event_id: string;
  player_ids: string[];
  num_courts: number;
  num_rounds: number;
}

interface Match {
  round_no: number;
  court_no: number;
  a1_player_id: string;
  a2_player_id: string;
  b1_player_id: string;
  b2_player_id: string;
  is_bye: boolean;
}

// Seeded random number generator for deterministic shuffling
class SeededRandom {
  private seed: number;

  constructor(seed: string) {
    this.seed = this.hashCode(seed);
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  shuffle<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}

function generateRoundRobinSchedule(
  eventId: string,
  playerIds: string[],
  numCourts: number,
  numRounds: number
): Match[] {
  const schedule: Match[] = [];
  const rng = new SeededRandom(eventId);
  
  // Track partner and opponent history
  const partnerCount: Record<string, Record<string, number>> = {};
  const opponentCount: Record<string, Record<string, number>> = {};
  const byeCount: Record<string, number> = {};
  const lastRoundPlayed: Record<string, number> = {};
  
  // Initialize tracking
  playerIds.forEach(p => {
    partnerCount[p] = {};
    opponentCount[p] = {};
    byeCount[p] = 0;
    lastRoundPlayed[p] = -2;
    playerIds.forEach(q => {
      if (p !== q) {
        partnerCount[p][q] = 0;
        opponentCount[p][q] = 0;
      }
    });
  });

  for (let round = 1; round <= numRounds; round++) {
    const availablePlayers = [...playerIds];
    const roundMatches: Match[] = [];
    let courtNum = 1;

    // Shuffle for variety (seeded for determinism)
    const shuffled = rng.shuffle(availablePlayers);
    const usedThisRound = new Set<string>();

    while (courtNum <= numCourts && shuffled.filter(p => !usedThisRound.has(p)).length >= 4) {
      const remaining = shuffled.filter(p => !usedThisRound.has(p));
      
      // Pick 4 players greedily based on:
      // 1. Haven't played recently (lastRoundPlayed)
      // 2. Minimize partner repeats
      // 3. Minimize opponent repeats
      
      const scorePlayers = (p: string) => {
        let score = 0;
        // Prefer players who haven't played recently
        const roundsSincePlay = round - lastRoundPlayed[p];
        score += roundsSincePlay * 10;
        // Prefer players with fewer byes
        score -= byeCount[p] * 5;
        return score;
      };

      const sorted = remaining.sort((a, b) => scorePlayers(b) - scorePlayers(a));
      const fourPlayers = sorted.slice(0, 4);

      if (fourPlayers.length < 4) break;

      // Form teams: try to minimize partner repeats
      const [p1, p2, p3, p4] = fourPlayers;
      
      // Simple heuristic: pair (p1, p2) vs (p3, p4) or (p1, p3) vs (p2, p4)
      const option1PartnerScore = (partnerCount[p1][p2] || 0) + (partnerCount[p3][p4] || 0);
      const option2PartnerScore = (partnerCount[p1][p3] || 0) + (partnerCount[p2][p4] || 0);

      let a1, a2, b1, b2;
      if (option1PartnerScore <= option2PartnerScore) {
        [a1, a2, b1, b2] = [p1, p2, p3, p4];
      } else {
        [a1, a2, b1, b2] = [p1, p3, p2, p4];
      }

      roundMatches.push({
        round_no: round,
        court_no: courtNum,
        a1_player_id: a1,
        a2_player_id: a2,
        b1_player_id: b1,
        b2_player_id: b2,
        is_bye: false,
      });

      // Update tracking
      [a1, a2, b1, b2].forEach(p => {
        usedThisRound.add(p);
        lastRoundPlayed[p] = round;
      });
      partnerCount[a1][a2]++;
      partnerCount[a2][a1]++;
      partnerCount[b1][b2]++;
      partnerCount[b2][b1]++;
      
      [a1, a2].forEach(a => {
        [b1, b2].forEach(b => {
          opponentCount[a][b]++;
          opponentCount[b][a]++;
        });
      });

      courtNum++;
    }

    // Handle byes
    const notPlaying = shuffled.filter(p => !usedThisRound.has(p));
    notPlaying.forEach(p => byeCount[p]++);

    schedule.push(...roundMatches);
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

    const { event_id, player_ids, num_courts, num_rounds }: ScheduleRequest = await req.json();

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

    // Delete existing schedule
    await supabase
      .from('round_robin_schedule')
      .delete()
      .eq('event_id', event_id);

    // Generate new schedule
    const schedule = generateRoundRobinSchedule(event_id, player_ids, num_courts, num_rounds);

    // Insert schedule
    const { error: insertError } = await supabase
      .from('round_robin_schedule')
      .insert(schedule.map(m => ({
        event_id,
        ...m,
      })));

    if (insertError) {
      console.error('Schedule insert failed:', { event_id: event_id.substring(0, 8), error_code: insertError.code });
      throw insertError;
    }

    return new Response(
      JSON.stringify({ success: true, matches_created: schedule.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Schedule generation failed:', { 
      error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
    });
    return new Response(
      JSON.stringify({ error: 'Failed to generate schedule' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
