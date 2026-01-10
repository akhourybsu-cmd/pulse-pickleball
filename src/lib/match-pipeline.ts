import { supabase } from '@/integrations/supabase/client';

export type MatchSource = 'manual' | 'round_robin' | 'tournament' | 'league' | 'import';
export type VerificationStatus = 'pending' | 'verified' | 'disputed' | 'rejected';

interface MatchValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

interface MatchData {
  team1Score: number;
  team2Score: number;
  team1Players: string[];
  team2Players: string[];
  eventId?: string | null;
  courtId?: string | null;
  roundNo?: number | null;
  courtNo?: number | null;
  matchDate: string;
  ratingEligible?: boolean;
  source?: MatchSource;
}

/**
 * Validates match data before submission.
 * Checks for:
 * - Valid scores
 * - Valid player combinations
 * - Duplicate prevention for event matches
 * - Rating eligibility requirements
 */
export async function validateMatch(data: MatchData): Promise<MatchValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Score validation
  if (data.team1Score < 0 || data.team2Score < 0) {
    errors.push('Scores cannot be negative');
  }

  if (data.team1Score === data.team2Score) {
    errors.push('Match cannot end in a tie');
  }

  // Player validation
  const allPlayers = [...data.team1Players, ...data.team2Players];
  const uniquePlayers = new Set(allPlayers);
  
  if (uniquePlayers.size !== allPlayers.length) {
    errors.push('A player cannot be on both teams');
  }

  if (data.team1Players.length === 0 || data.team2Players.length === 0) {
    errors.push('Both teams must have at least one player');
  }

  // Doubles validation
  if (data.team1Players.length !== data.team2Players.length) {
    warnings.push('Teams have different number of players');
  }

  // Event match duplicate check
  if (data.eventId && data.roundNo !== undefined && data.courtNo !== undefined) {
    const { data: existing } = await supabase
      .from('matches')
      .select('id')
      .eq('event_id', data.eventId)
      .eq('round_no', data.roundNo)
      .eq('court_no', data.courtNo)
      .is('voided', false)
      .maybeSingle();

    if (existing) {
      errors.push('A match already exists for this event, round, and court');
    }
  }

  // Rating eligibility warning for manual matches
  if (data.ratingEligible && !data.eventId && data.source === 'manual') {
    warnings.push('Manual matches require verification before affecting ratings');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Creates a match with proper source tracking and verification status.
 */
export async function createMatch(
  data: MatchData & { createdBy: string }
): Promise<{ matchId: string | null; error: string | null }> {
  const validation = await validateMatch(data);
  
  if (!validation.isValid) {
    return { matchId: null, error: validation.errors.join(', ') };
  }

  const source = data.source || (data.eventId ? 'round_robin' : 'manual');
  const verificationStatus: VerificationStatus = 
    data.eventId ? 'verified' : 'pending';

  try {
    // Create the match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        created_by: data.createdBy,
        match_date: data.matchDate,
        team1_score: data.team1Score,
        team2_score: data.team2Score,
        event_id: data.eventId || null,
        court_id: data.courtId || null,
        round_no: data.roundNo || null,
        court_no: data.courtNo || null,
        rating_eligible: data.ratingEligible ?? true,
        source,
        verification_status: verificationStatus,
        status: data.eventId ? 'approved' : 'pending',
      })
      .select('id')
      .single();

    if (matchError) throw matchError;

    // Add participants
    const participants = [
      ...data.team1Players.map(playerId => ({
        match_id: match.id,
        player_id: playerId,
        team: 1,
      })),
      ...data.team2Players.map(playerId => ({
        match_id: match.id,
        player_id: playerId,
        team: 2,
      })),
    ];

    const { error: participantError } = await supabase
      .from('match_participants')
      .insert(participants);

    if (participantError) throw participantError;

    return { matchId: match.id, error: null };
  } catch (error: any) {
    console.error('Error creating match:', error);
    return { matchId: null, error: error.message || 'Failed to create match' };
  }
}

/**
 * Verifies a manual match, allowing it to affect ratings.
 * Requires verification from participants or admin.
 */
export async function verifyMatch(
  matchId: string,
  verifierId: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    // Check if verifier is a participant
    const { data: participant } = await supabase
      .from('match_participants')
      .select('id')
      .eq('match_id', matchId)
      .eq('player_id', verifierId)
      .maybeSingle();

    if (!participant) {
      // Check if verifier is an admin
      const { data: adminRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', verifierId)
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminRole) {
        return { success: false, error: 'Only participants or admins can verify matches' };
      }
    }

    // Get current verified_by array
    const { data: match } = await supabase
      .from('matches')
      .select('verified_by')
      .eq('id', matchId)
      .single();

    const currentVerifiers = (match?.verified_by as string[]) || [];
    const updatedVerifiers = currentVerifiers.includes(verifierId) 
      ? currentVerifiers 
      : [...currentVerifiers, verifierId];

    // Update verification status
    const { error } = await supabase
      .from('matches')
      .update({
        verification_status: 'verified',
        status: 'approved',
        verified_by: updatedVerifiers,
      })
      .eq('id', matchId);

    if (error) throw error;

    // Trigger rating recalculation
    await supabase.rpc('recalculate_all_ratings_authenticated');

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error verifying match:', error);
    return { success: false, error: error.message || 'Failed to verify match' };
  }
}

/**
 * Disputes a match, preventing it from affecting ratings until resolved.
 */
export async function disputeMatch(
  matchId: string,
  disputerId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  try {
    const { error } = await supabase
      .from('matches')
      .update({
        verification_status: 'disputed',
        status: 'pending',
      })
      .eq('id', matchId);

    if (error) throw error;

    // Create contested match record
    await supabase
      .from('contested_matches')
      .insert({
        match_id: matchId,
        contested_by: disputerId,
        reason,
      });

    return { success: true, error: null };
  } catch (error: any) {
    console.error('Error disputing match:', error);
    return { success: false, error: error.message || 'Failed to dispute match' };
  }
}
