import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BadgeCheck {
  code: string;
  earned: boolean;
  progress?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { player_id } = await req.json();
    
    if (!player_id) {
      return new Response(
        JSON.stringify({ error: 'player_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculating badges for player: ${player_id.substring(0, 8)}`);

    // Fetch all badge definitions
    const { data: allBadges } = await supabase
      .from('badges')
      .select('*')
      .order('tier', { ascending: true });

    if (!allBadges) {
      throw new Error('Failed to fetch badges');
    }

    // Fetch player's matches
    const { data: playerMatches } = await supabase
      .from('match_participants')
      .select(`
        *,
        matches!inner(
          id,
          match_date,
          created_at,
          team1_score,
          team2_score,
          status,
          court_id
        )
      `)
      .eq('player_id', player_id)
      .eq('matches.status', 'approved')
      .order('matches.match_date', { ascending: true });

    if (!playerMatches || playerMatches.length === 0) {
      console.log('No matches found for player');
      return new Response(
        JSON.stringify({ badgesAwarded: 0, message: 'No matches found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const badgeChecks: BadgeCheck[] = [];

    // Check each badge type
    for (const badge of allBadges) {
      const check = await checkBadge(badge.code, player_id, playerMatches, supabase);
      badgeChecks.push({ code: badge.code, ...check });

      // Award badge if earned and not already awarded
      if (check.earned) {
        const { data: existingBadge } = await supabase
          .from('player_badges')
          .select('id')
          .eq('player_id', player_id)
          .eq('badge_id', badge.id)
          .single();

        if (!existingBadge) {
          await supabase.from('player_badges').insert({
            player_id,
            badge_id: badge.id,
            progress: check.progress
          });
          console.log(`Awarded badge: ${badge.code}`);
        }
      }
    }

    const awardedCount = badgeChecks.filter(b => b.earned).length;

    return new Response(
      JSON.stringify({ 
        badgesAwarded: awardedCount,
        checks: badgeChecks
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Badge calculation failed:', { 
      error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
    });
    return new Response(
      JSON.stringify({ error: 'Failed to calculate badges' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function checkBadge(
  badgeCode: string,
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  
  switch (badgeCode) {
    case 'daily_grinder_1':
      return checkDailyGrinder(matches, 3);
    case 'daily_grinder_2':
      return checkDailyGrinder(matches, 7);
    case 'daily_grinder_3':
      return checkDailyGrinder(matches, 30);
    
    case 'weekly_warrior':
      return checkWeeklyWarrior(matches);
    
    case 'iron_day':
      return checkIronDay(matches);
    
    case 'partner_explorer_1':
      return await checkPartnerExplorer(playerId, matches, supabase, 5);
    case 'partner_explorer_2':
      return await checkPartnerExplorer(playerId, matches, supabase, 12);
    
    case 'venue_hopper':
      return checkVenueHopper(matches);
    
    case 'fast_confirmer':
      return await checkFastConfirmer(playerId, supabase);
    
    case 'early_bird':
      return await checkEarlyBird(matches, playerId, supabase);
    case 'night_owl':
      return await checkNightOwl(matches, playerId, supabase);
    
    case 'over_three_club':
      return checkRatingStreak(matches, 3.00, 30);
    case 'steady_three_five':
      return checkRatingStreak(matches, 3.50, 30);
    case 'steady_four_oh':
      return checkRatingStreak(matches, 4.00, 30);
    
    case 'riser_1':
      return checkRiser(matches, 0.50);
    case 'riser_2':
      return checkRiser(matches, 1.00);
    case 'riser_3':
      return checkRiser(matches, 2.00);
    
    case 'hot_hand':
      return checkHotHand(matches);
    
    case 'slump_buster':
      return checkSlumpBuster(matches);
    
    case 'rock_solid':
      return checkRockSolid(matches);
    
    case 'shutout':
      return checkShutout(matches);
    
    case 'lockdown':
      return checkLockdown(matches);
    
    case 'nail_biter':
      return checkNailBiter(matches);
    
    case 'marathon':
      return checkMarathon(matches);
    
    case 'day_sweeper':
      return checkDaySweeper(matches);
    
    case 'upset_alert':
      return await checkUpset(playerId, matches, supabase, 0.35);
    case 'giant_killer':
      return await checkUpset(playerId, matches, supabase, 0.25);
    
    case 'dragon_slayer':
      return await checkDragonSlayer(playerId, matches, supabase);
    
    case 'dynamic_duo':
      return await checkDynamicDuo(playerId, matches, supabase);
    
    case 'power_pair':
      return await checkPowerPair(playerId, matches, supabase);
    
    case 'rivalry_settled':
      return await checkRivalrySettled(playerId, matches, supabase);
    
    case 'mentor':
      return await checkMentor(playerId, matches, supabase);
    
    default:
      return { earned: false };
  }
}

function checkDailyGrinder(matches: any[], days: number): { earned: boolean; progress?: any } {
  if (matches.length === 0) return { earned: false };
  
  const uniqueDates = [...new Set(matches.map(m => m.matches.match_date))].sort();
  let maxStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const dayDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (dayDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return { earned: maxStreak >= days, progress: { maxStreak } };
}

function checkWeeklyWarrior(matches: any[]): { earned: boolean; progress?: any } {
  if (matches.length === 0) return { earned: false };
  
  const weeks = new Set(
    matches.map(m => {
      const date = new Date(m.matches.match_date);
      const year = date.getFullYear();
      const week = getWeekNumber(date);
      return `${year}-W${week}`;
    })
  );
  
  const sortedWeeks = Array.from(weeks).sort();
  let maxConsecutive = 1;
  let current = 1;
  
  for (let i = 1; i < sortedWeeks.length; i++) {
    const [prevYear, prevWeek] = sortedWeeks[i - 1].split('-W').map(Number);
    const [currYear, currWeek] = sortedWeeks[i].split('-W').map(Number);
    
    if ((currYear === prevYear && currWeek === prevWeek + 1) ||
        (currYear === prevYear + 1 && currWeek === 1 && prevWeek >= 52)) {
      current++;
      maxConsecutive = Math.max(maxConsecutive, current);
    } else {
      current = 1;
    }
  }
  
  return { earned: maxConsecutive >= 4, progress: { maxConsecutive } };
}

function checkIronDay(matches: any[]): { earned: boolean; progress?: any } {
  const dateGroups = new Map<string, number>();
  
  for (const match of matches) {
    const date = match.matches.match_date;
    dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
  }
  
  const maxGamesInDay = Math.max(...dateGroups.values(), 0);
  return { earned: maxGamesInDay >= 8, progress: { maxGamesInDay } };
}

async function checkPartnerExplorer(
  playerId: string,
  matches: any[],
  supabase: any,
  requiredPartners: number
): Promise<{ earned: boolean; progress?: any }> {
  const wonMatches = matches.filter(m => m.rating_change > 0);
  const partners = new Set<string>();
  
  for (const match of wonMatches) {
    const { data: partnerData } = await supabase
      .rpc('get_partner_id', { 
        match_id_param: match.matches.id, 
        player_id_param: playerId 
      });
    
    if (partnerData) {
      partners.add(partnerData);
    }
  }
  
  return { 
    earned: partners.size >= requiredPartners, 
    progress: { uniquePartners: partners.size } 
  };
}

function checkVenueHopper(matches: any[]): { earned: boolean; progress?: any } {
  const wonMatches = matches.filter(m => m.rating_change > 0);
  const venues = new Set(wonMatches.map(m => m.matches.court_id).filter(Boolean));
  
  return { 
    earned: venues.size >= 3, 
    progress: { uniqueVenues: venues.size } 
  };
}

async function checkFastConfirmer(playerId: string, supabase: any): Promise<{ earned: boolean; progress?: any }> {
  const { data: approvals } = await supabase
    .from('match_approvals')
    .select('*, matches!inner(created_at)')
    .eq('player_id', playerId)
    .eq('approved', true);
  
  if (!approvals) return { earned: false };
  
  const fastConfirms = approvals.filter((a: any) => {
    const created = new Date(a.matches.created_at);
    const approved = new Date(a.approved_at);
    const minutesDiff = (approved.getTime() - created.getTime()) / (1000 * 60);
    return minutesDiff <= 15;
  });
  
  return { 
    earned: fastConfirms.length >= 5, 
    progress: { fastConfirms: fastConfirms.length } 
  };
}

async function checkEarlyBird(matches: any[], playerId: string, supabase: any): Promise<{ earned: boolean; progress?: any }> {
  let earlyBirdCount = 0;
  
  const uniqueDates = [...new Set(matches.map(m => m.matches.match_date))];
  
  for (const date of uniqueDates) {
    const { data: dayMatches } = await supabase
      .from('matches')
      .select('id, created_at')
      .eq('match_date', date)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (dayMatches && dayMatches.length > 0) {
      const firstMatch = dayMatches[0];
      const playerInMatch = matches.some(m => m.matches.id === firstMatch.id);
      if (playerInMatch) earlyBirdCount++;
    }
  }
  
  return { earned: earlyBirdCount >= 5, progress: { earlyBirdCount } };
}

async function checkNightOwl(matches: any[], playerId: string, supabase: any): Promise<{ earned: boolean; progress?: any }> {
  let nightOwlCount = 0;
  
  const uniqueDates = [...new Set(matches.map(m => m.matches.match_date))];
  
  for (const date of uniqueDates) {
    const { data: dayMatches } = await supabase
      .from('matches')
      .select('id, created_at')
      .eq('match_date', date)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (dayMatches && dayMatches.length > 0) {
      const lastMatch = dayMatches[0];
      const playerInMatch = matches.some(m => m.matches.id === lastMatch.id);
      if (playerInMatch) nightOwlCount++;
    }
  }
  
  return { earned: nightOwlCount >= 5, progress: { nightOwlCount } };
}

function checkRatingStreak(matches: any[], minRating: number, days: number): { earned: boolean; progress?: any } {
  if (matches.length === 0) return { earned: false };
  
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(a.matches.match_date).getTime() - new Date(b.matches.match_date).getTime()
  );
  
  let streakDays = 0;
  let lastDate: string | null = null;
  
  for (const match of sortedMatches) {
    if (match.rating_after >= minRating) {
      if (!lastDate || match.matches.match_date !== lastDate) {
        streakDays++;
        lastDate = match.matches.match_date;
      }
    } else {
      streakDays = 0;
      lastDate = null;
    }
    
    if (streakDays >= days) {
      return { earned: true, progress: { streakDays } };
    }
  }
  
  return { earned: false, progress: { streakDays } };
}

function checkRiser(matches: any[], ratingGain: number): { earned: boolean; progress?: any } {
  if (matches.length === 0) return { earned: false };
  
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(a.matches.match_date).getTime() - new Date(b.matches.match_date).getTime()
  );
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentMatches = sortedMatches.filter(m => 
    new Date(m.matches.match_date) >= thirtyDaysAgo
  );
  
  if (recentMatches.length === 0) return { earned: false };
  
  const startRating = recentMatches[0].rating_before;
  const endRating = recentMatches[recentMatches.length - 1].rating_after;
  const actualGain = endRating - startRating;
  
  return { 
    earned: actualGain >= ratingGain, 
    progress: { ratingGain: actualGain } 
  };
}

function checkHotHand(matches: any[]): { earned: boolean; progress?: any } {
  const dateGroups = new Map<string, number>();
  
  for (const match of matches) {
    const date = match.matches.match_date;
    const current = dateGroups.get(date) || 0;
    dateGroups.set(date, current + match.rating_change);
  }
  
  const maxDayGain = Math.max(...Array.from(dateGroups.values()), 0);
  return { earned: maxDayGain >= 0.20, progress: { maxDayGain } };
}

function checkSlumpBuster(matches: any[]): { earned: boolean; progress?: any } {
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(a.matches.match_date).getTime() - new Date(b.matches.match_date).getTime()
  );
  
  for (let i = 3; i < sortedMatches.length; i++) {
    const lastThree = sortedMatches.slice(i - 3, i);
    const allLosses = lastThree.every(m => m.rating_change < 0);
    const nextWin = sortedMatches[i].rating_change > 0;
    
    if (allLosses && nextWin) {
      return { earned: true };
    }
  }
  
  return { earned: false };
}

function checkRockSolid(matches: any[]): { earned: boolean; progress?: any } {
  const last30 = matches.slice(-30);
  if (last30.length < 30) return { earned: false };
  
  const wins = last30.filter(m => m.rating_change > 0).length;
  const winRate = wins / last30.length;
  
  return { earned: winRate >= 0.60, progress: { winRate } };
}

function checkShutout(matches: any[]): { earned: boolean; progress?: any } {
  const hasShutout = matches.some(m => {
    const won = m.rating_change > 0;
    const team = m.team;
    const score = team === 1 ? m.matches.team1_score : m.matches.team2_score;
    const oppScore = team === 1 ? m.matches.team2_score : m.matches.team1_score;
    return won && score === 11 && oppScore === 0;
  });
  
  return { earned: hasShutout };
}

function checkLockdown(matches: any[]): { earned: boolean; progress?: any } {
  const hasLockdown = matches.some(m => {
    const won = m.rating_change > 0;
    const team = m.team;
    const oppScore = team === 1 ? m.matches.team2_score : m.matches.team1_score;
    return won && oppScore <= 4;
  });
  
  return { earned: hasLockdown };
}

function checkNailBiter(matches: any[]): { earned: boolean; progress?: any } {
  const hasNailBiter = matches.some(m => {
    const won = m.rating_change > 0;
    const team = m.team;
    const score = team === 1 ? m.matches.team1_score : m.matches.team2_score;
    const oppScore = team === 1 ? m.matches.team2_score : m.matches.team1_score;
    return won && score - oppScore === 2 && score >= 12;
  });
  
  return { earned: hasNailBiter };
}

function checkMarathon(matches: any[]): { earned: boolean; progress?: any } {
  const hasMarathon = matches.some(m => {
    const won = m.rating_change > 0;
    const team = m.team;
    const score = team === 1 ? m.matches.team1_score : m.matches.team2_score;
    return won && score >= 14;
  });
  
  return { earned: hasMarathon };
}

function checkDaySweeper(matches: any[]): { earned: boolean; progress?: any } {
  const dateGroups = new Map<string, any[]>();
  
  for (const match of matches) {
    const date = match.matches.match_date;
    if (!dateGroups.has(date)) {
      dateGroups.set(date, []);
    }
    dateGroups.get(date)!.push(match);
  }
  
  for (const [_, dayMatches] of dateGroups) {
    if (dayMatches.length >= 5) {
      const allWins = dayMatches.every(m => m.rating_change > 0);
      if (allWins) {
        return { earned: true };
      }
    }
  }
  
  return { earned: false };
}

async function checkUpset(
  playerId: string,
  matches: any[],
  supabase: any,
  maxWinProb: number
): Promise<{ earned: boolean; progress?: any }> {
  for (const match of matches) {
    if (match.rating_change <= 0) continue;
    
    const { data: allParticipants } = await supabase
      .from('match_participants')
      .select('player_id, team, rating_before')
      .eq('match_id', match.matches.id);
    
    if (!allParticipants || allParticipants.length !== 4) continue;
    
    const playerTeam = match.team;
    const teammates = allParticipants.filter((p: any) => p.team === playerTeam);
    const opponents = allParticipants.filter((p: any) => p.team !== playerTeam);
    
    if (teammates.length !== 2 || opponents.length !== 2) continue;
    
    const { data: winProb } = await supabase
      .rpc('calculate_win_probability', {
        player_rating: teammates[0].rating_before,
        partner_rating: teammates[1].rating_before,
        opponent1_rating: opponents[0].rating_before,
        opponent2_rating: opponents[1].rating_before
      });
    
    if (winProb !== null && winProb < maxWinProb) {
      return { earned: true, progress: { winProb } };
    }
  }
  
  return { earned: false };
}

async function checkDragonSlayer(
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  for (const match of matches) {
    if (match.rating_change <= 0) continue;
    
    const { data: allParticipants } = await supabase
      .from('match_participants')
      .select('player_id, team, rating_before')
      .eq('match_id', match.matches.id);
    
    if (!allParticipants || allParticipants.length !== 4) continue;
    
    const playerTeam = match.team;
    const teammates = allParticipants.filter((p: any) => p.team === playerTeam);
    const opponents = allParticipants.filter((p: any) => p.team !== playerTeam);
    
    const teamAvg = (teammates[0].rating_before + teammates[1].rating_before) / 2;
    const oppAvg = (opponents[0].rating_before + opponents[1].rating_before) / 2;
    
    if (oppAvg - teamAvg >= 0.30) {
      return { earned: true, progress: { ratingDiff: oppAvg - teamAvg } };
    }
  }
  
  return { earned: false };
}

async function checkDynamicDuo(
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  const wonMatches = matches.filter(m => m.rating_change > 0);
  const partnerWins = new Map<string, any[]>();
  
  for (const match of wonMatches) {
    const { data: partnerId } = await supabase
      .rpc('get_partner_id', { 
        match_id_param: match.matches.id, 
        player_id_param: playerId 
      });
    
    if (partnerId) {
      if (!partnerWins.has(partnerId)) {
        partnerWins.set(partnerId, []);
      }
      partnerWins.get(partnerId)!.push(match);
    }
  }
  
  for (const [_, wins] of partnerWins) {
    const last10 = wins.slice(-10);
    const last5 = wins.slice(-5);
    if (last5.length === 5 && last10.length >= 5) {
      return { earned: true, progress: { consecutiveWins: 5 } };
    }
  }
  
  return { earned: false };
}

async function checkPowerPair(
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  const partnerGames = new Map<string, { wins: number; total: number }>();
  
  for (const match of matches) {
    const { data: partnerId } = await supabase
      .rpc('get_partner_id', { 
        match_id_param: match.matches.id, 
        player_id_param: playerId 
      });
    
    if (partnerId) {
      if (!partnerGames.has(partnerId)) {
        partnerGames.set(partnerId, { wins: 0, total: 0 });
      }
      const stats = partnerGames.get(partnerId)!;
      stats.total++;
      if (match.rating_change > 0) stats.wins++;
    }
  }
  
  for (const [_, stats] of partnerGames) {
    const winRate = stats.wins / stats.total;
    if (stats.wins >= 20 && winRate >= 0.70) {
      return { earned: true, progress: { wins: stats.wins, winRate } };
    }
  }
  
  return { earned: false };
}

async function checkRivalrySettled(
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  const wonMatches = matches.filter(m => m.rating_change > 0);
  const opponentPairWins = new Map<string, number>();
  
  for (const match of wonMatches) {
    const { data: allParticipants } = await supabase
      .from('match_participants')
      .select('player_id, team')
      .eq('match_id', match.matches.id)
      .order('player_id');
    
    if (!allParticipants || allParticipants.length !== 4) continue;
    
    const opponents = allParticipants
      .filter((p: any) => p.team !== match.team)
      .map((p: any) => p.player_id)
      .sort()
      .join('-');
    
    opponentPairWins.set(opponents, (opponentPairWins.get(opponents) || 0) + 1);
  }
  
  const maxWinsAgainstPair = Math.max(...opponentPairWins.values(), 0);
  return { 
    earned: maxWinsAgainstPair >= 3, 
    progress: { maxWinsAgainstPair } 
  };
}

async function checkMentor(
  playerId: string,
  matches: any[],
  supabase: any
): Promise<{ earned: boolean; progress?: any }> {
  const wonMatches = matches.filter(m => m.rating_change > 0);
  let mentorWins = 0;
  
  for (const match of wonMatches) {
    const { data: partnerId } = await supabase
      .rpc('get_partner_id', { 
        match_id_param: match.matches.id, 
        player_id_param: playerId 
      });
    
    if (partnerId) {
      const { data: partnerParticipant } = await supabase
        .from('match_participants')
        .select('rating_before')
        .eq('match_id', match.matches.id)
        .eq('player_id', partnerId)
        .single();
      
      if (partnerParticipant && 
          match.rating_before - partnerParticipant.rating_before >= 0.20) {
        mentorWins++;
      }
    }
  }
  
  return { earned: mentorWins >= 5, progress: { mentorWins } };
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
