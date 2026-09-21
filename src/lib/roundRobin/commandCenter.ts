import { roundProgress } from './roundProgress';

export interface CommandMatch {
  id: string;
  round_no: number;
  court_no: number;
  is_bye: boolean;
  team1_score: number | null;
  team2_score: number | null;
  abandoned?: boolean | null;
  voided_at?: string | null;
  superseded_by_schedule_id?: string | null;
  team1: string[];
  team2: string[];
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
