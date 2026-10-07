import { roundProgress } from './roundProgress';
import type { StandingsSeatRow } from './standings';

export interface CommandMatch extends StandingsSeatRow {
  id: string;
  round_no: number;
  court_no: number;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  abandoned?: boolean | null;
  abandoned_reason?: string | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  team1: string[];
  team2: string[];
}

/** Mutations advance consecutive rounds; browsing can still inspect sparse history. */
export function commandRoundAction(rounds: number[], currentRound: number, totalRounds: number) {
  if (!rounds.includes(currentRound)) return null;
  const next = rounds.find(round => round > currentRound);
  if (next === currentRound + 1 && currentRound < totalRounds) return 'advance';
  if (next === undefined && currentRound === totalRounds) return 'complete';
  return null;
}

/** Only saved, canonical rounds belong in the host's navigation. */
export function commandSchedule(matches: CommandMatch[], currentRound: number) {
  const active = matches.filter(match => !match.voided_at && !match.superseded_by_schedule_id);
  const rounds = [...new Set(active.map(match => match.round_no))].sort((a, b) => a - b);
  return {
    matches: active,
    rounds,
    nextRound: rounds.find(round => round > currentRound) ?? null,
    progress: roundProgress(active.filter(match => match.round_no === currentRound)),
  };
}

export function canScoreCommandMatch(match: CommandMatch, status: string, currentRound: number, voided: boolean) {
  return !voided && status === 'live' && match.round_no === currentRound && !match.is_bye &&
    !match.abandoned && !match.voided_at && !match.superseded_by_schedule_id &&
    match.team1_score === null && match.team2_score === null;
}
