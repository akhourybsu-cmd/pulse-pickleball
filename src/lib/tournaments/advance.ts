import { supabase } from '@/integrations/supabase/client';
import { nextSlot } from './singleElimination';
import {
  routeWinner as routeWinnerDouble,
  routeLoser as routeLoserDouble,
  type BracketSide,
  type Destination,
} from './doubleElimination';
import { bracketSizeFor } from './seeding';

/**
 * Winner (and loser) advancement for elimination draws.
 *
 * Nothing in the codebase advanced anyone — a bracket was frozen after the
 * round it was generated in. This closes that loop for both formats:
 *
 *   • single elimination — placement is structural, so the winner of round r
 *     match m goes to round r+1 match ceil(m/2);
 *   • double elimination — the winner moves along its own ladder while the
 *     LOSER drops into the losers bracket, which is the whole point of the
 *     format and is what makes the `bracket` column necessary.
 */

export type AdvanceOutcome =
  | { advanced: false; reason: 'not_elimination' | 'final' | 'tie' | 'no_target' }
  | { advanced: true; downstreamDirty: boolean };

export function winnerOf(
  team1Id: string | null,
  team2Id: string | null,
  team1Score: number,
  team2Score: number,
): string | null {
  if (team1Score === team2Score) return null;
  return team1Score > team2Score ? team1Id : team2Id;
}

/** Write a team into a destination slot. Returns whether that slot was already played. */
async function placeInSlot(
  divisionId: string,
  dest: Destination,
  teamId: string,
): Promise<{ found: boolean; wasCompleted: boolean }> {
  let q = supabase
    .from('tournaments_matches')
    .select('id, status, team1_id, team2_id')
    .eq('division_id', divisionId)
    .eq('round_number', dest.round)
    .eq('match_number', dest.matchNumber);

  // Only constrain on bracket for multi-bracket draws; single-elim rows
  // generated before the discriminator existed carry NULL.
  if (dest.bracket !== 'winners') {
    q = q.eq('bracket', dest.bracket);
  } else {
    q = q.or('bracket.eq.winners,bracket.is.null');
  }

  const { data: target } = await q.maybeSingle();
  if (!target) return { found: false, wasCompleted: false };

  const column = dest.side === 'A' ? 'team1_id' : 'team2_id';
  const current = dest.side === 'A' ? target.team1_id : target.team2_id;
  if (current === teamId) return { found: true, wasCompleted: false };

  const { error } = await supabase
    .from('tournaments_matches')
    .update({ [column]: teamId })
    .eq('id', target.id);
  if (error) throw error;

  return { found: true, wasCompleted: target.status === 'completed' };
}

/**
 * Push the result of a just-completed match through the draw.
 *
 * Returns `downstreamDirty: true` when a destination had ALREADY been played —
 * which happens when an organizer edits an earlier score after the bracket has
 * moved on. The slot is still corrected, but the caller should warn rather than
 * leave a silently corrupted draw.
 */
export async function advanceWinner(params: {
  matchId: string;
  winnerTeamId: string;
  loserTeamId?: string | null;
}): Promise<AdvanceOutcome> {
  const { matchId, winnerTeamId, loserTeamId } = params;

  // Derive position/format from the match itself — the various score-entry
  // surfaces pass differently-shaped match objects around.
  const { data: source } = await supabase
    .from('tournaments_matches')
    .select('division_id, round_number, match_number, bracket')
    .eq('id', matchId)
    .single();

  if (!source) return { advanced: false, reason: 'no_target' };
  const divisionId = source.division_id as string;
  const round = source.round_number as number;
  const matchNumber = source.match_number as number;

  const { data: division } = await supabase
    .from('tournaments_divisions')
    .select('format')
    .eq('id', divisionId)
    .single();

  const format = division?.format;
  if (format !== 'single_elimination' && format !== 'double_elimination') {
    return { advanced: false, reason: 'not_elimination' };
  }

  // ---------- single elimination ----------
  if (format === 'single_elimination') {
    const { data: deepest } = await supabase
      .from('tournaments_matches')
      .select('round_number')
      .eq('division_id', divisionId)
      .order('round_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const totalRounds = deepest?.round_number ?? round;
    const target = nextSlot(round, matchNumber, totalRounds);
    if (!target) return { advanced: false, reason: 'final' };

    const res = await placeInSlot(
      divisionId,
      { bracket: 'winners', round: target.round, matchNumber: target.matchNumber, side: target.side },
      winnerTeamId,
    );
    if (!res.found) return { advanced: false, reason: 'no_target' };
    return { advanced: true, downstreamDirty: res.wasCompleted };
  }

  // ---------- double elimination ----------
  // Bracket size is recoverable from the number of teams in the division.
  const { count } = await supabase
    .from('tournaments_teams')
    .select('id', { count: 'exact', head: true })
    .eq('division_id', divisionId);

  const bracketSize = bracketSizeFor(count ?? 0);
  const bracket = (source.bracket ?? 'winners') as BracketSide;

  let dirty = false;
  let placedAnything = false;

  const winnerDest = routeWinnerDouble(bracketSize, bracket, round, matchNumber);
  if (winnerDest) {
    const res = await placeInSlot(divisionId, winnerDest, winnerTeamId);
    placedAnything ||= res.found;
    dirty ||= res.wasCompleted;
  }

  // The defining move of double elimination: the loser drops rather than exits.
  if (loserTeamId) {
    const loserDest = routeLoserDouble(bracketSize, bracket, round, matchNumber);
    if (loserDest) {
      const res = await placeInSlot(divisionId, loserDest, loserTeamId);
      placedAnything ||= res.found;
      dirty ||= res.wasCompleted;
    }
  }

  if (!winnerDest && !placedAnything) return { advanced: false, reason: 'final' };
  return { advanced: true, downstreamDirty: dirty };
}
