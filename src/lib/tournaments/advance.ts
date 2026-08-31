import { supabase } from '@/integrations/supabase/client';
import { nextSlot } from './singleElimination';

/**
 * Winner advancement for elimination draws.
 *
 * Nothing in the codebase advanced a winner — a bracket was frozen after the
 * round it was generated in. This closes that loop: when an elimination match
 * is completed, the winner is written into the slot it feeds.
 *
 * Placement is structural (see nextSlot): the winner of round r match m goes to
 * round r+1, match ceil(m/2), side A when m is odd and B when m is even. No
 * feeder columns are needed on tournaments_matches.
 */

export type AdvanceOutcome =
  | { advanced: false; reason: 'not_elimination' | 'final' | 'tie' | 'no_target' }
  | { advanced: true; downstreamDirty: boolean };

/** Formats whose winners flow into a later round. */
const ELIMINATION_FORMATS = new Set(['single_elimination', 'double_elimination']);

export function winnerOf(
  team1Id: string | null,
  team2Id: string | null,
  team1Score: number,
  team2Score: number,
): string | null {
  if (team1Score === team2Score) return null;
  return team1Score > team2Score ? team1Id : team2Id;
}

/**
 * Push the winner of a just-completed match into its next slot.
 *
 * Returns `downstreamDirty: true` when the target match had ALREADY been played
 * — which happens if an organizer edits an earlier score after the bracket has
 * moved on. We still correct the slot, but the caller should warn that results
 * further down the draw are now based on a superseded winner rather than
 * silently leaving a corrupted bracket.
 */
export async function advanceWinner(params: {
  matchId: string;
  winnerTeamId: string;
}): Promise<AdvanceOutcome> {
  const { matchId, winnerTeamId } = params;

  // Derive position + format from the match itself, so callers only need the id
  // (the various score-entry surfaces carry different match shapes).
  const { data: source } = await supabase
    .from('tournaments_matches')
    .select('division_id, round_number, match_number')
    .eq('id', matchId)
    .single();

  if (!source) return { advanced: false, reason: 'no_target' };
  const { division_id: divisionId, round_number: roundNumber, match_number: matchNumber } = source;

  const { data: division } = await supabase
    .from('tournaments_divisions')
    .select('format')
    .eq('id', divisionId)
    .single();

  if (!division || !ELIMINATION_FORMATS.has(division.format)) {
    return { advanced: false, reason: 'not_elimination' };
  }

  // The draw's depth is however many rounds were generated for it.
  const { data: deepest } = await supabase
    .from('tournaments_matches')
    .select('round_number')
    .eq('division_id', divisionId)
    .order('round_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const totalRounds = deepest?.round_number ?? roundNumber;
  const target = nextSlot(roundNumber, matchNumber, totalRounds);
  if (!target) return { advanced: false, reason: 'final' };

  const { data: targetMatch } = await supabase
    .from('tournaments_matches')
    .select('id, status, team1_id, team2_id')
    .eq('division_id', divisionId)
    .eq('round_number', target.round)
    .eq('match_number', target.matchNumber)
    .maybeSingle();

  if (!targetMatch) return { advanced: false, reason: 'no_target' };

  const column = target.side === 'A' ? 'team1_id' : 'team2_id';
  const current = target.side === 'A' ? targetMatch.team1_id : targetMatch.team2_id;

  // Already correct — nothing to do (re-saving an unchanged score is common).
  if (current === winnerTeamId) {
    return { advanced: true, downstreamDirty: false };
  }

  const { error } = await supabase
    .from('tournaments_matches')
    .update({ [column]: winnerTeamId })
    .eq('id', targetMatch.id);

  if (error) throw error;

  return { advanced: true, downstreamDirty: targetMatch.status === 'completed' };
}
