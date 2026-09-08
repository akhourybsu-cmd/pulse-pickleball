import type { LeagueMatch, LeagueMember, LeagueSeason, LeagueSession, LeagueStatus } from './types';

export function ladderActivationIssues(leagueStatus: LeagueStatus, season?: Pick<LeagueSeason, 'status'>) {
  const issues: { tab: 'overview' | 'seasons'; message: string; label: string }[] = [];
  if (leagueStatus !== 'active') issues.push({tab:'overview',label:'Review league status',
    message:`The league is ${leagueStatus}. Set its status to Active in Overview and save before generating more games.`});
  if (!season || season.status !== 'active') issues.push({tab:'seasons',label:'Review season status',
    message:season ? `This season is ${season.status}. Edit it in Seasons and set its status to Active before generating more games.`
      : 'Select an active season before generating games.'});
  return issues;
}

const priority = { active: 0, draft: 1, completed: 2, archived: 3 };
export function sortLeagueSeasons(seasons: LeagueSeason[]) {
  return [...seasons].sort((a, b) => priority[a.status] - priority[b.status]
    || (b.start_date ?? b.created_at).localeCompare(a.start_date ?? a.created_at)
    || a.id.localeCompare(b.id));
}

export function selectLeagueSeason(seasons: LeagueSeason[], requested?: string | null) {
  return seasons.find(s => s.id === requested) ?? sortLeagueSeasons(seasons)[0] ?? null;
}

export function selectSeasonMembership(memberships: LeagueMember[], seasonId?: string | null) {
  return memberships.find(m => m.season_id === seasonId && m.status === 'active')
    ?? memberships.find(m => m.season_id === null && m.status === 'active') ?? null;
}

export function canManageLeague(owner: string, userId: string | null, memberships: LeagueMember[]) {
  return !!userId && (owner === userId || memberships.some(m =>
    m.user_id === userId && m.role === 'manager' && m.status === 'active'));
}

export function parseWholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= 2147483647 ? number : null;
}

export function validateScorePair(a: string, b: string, required = false): string | null {
  if (!a.trim() && !b.trim() && !required) return null;
  const x = parseWholeNumber(a), y = parseWholeNumber(b);
  if (x === null || y === null) return 'Enter a non-negative whole number for both scores, or leave both blank.';
  return x === y ? 'Scores cannot be tied.' : null;
}

export function validateSeasonDates(start: string, end: string, registration: string): string | null {
  if (start && end && end < start) return 'End date must be on or after the start date.';
  if (registration && end && registration > end) return 'Registration cannot close after the season ends.';
  return null;
}

export function validateSessionInputs(start: string, end: string, courts: string): string | null {
  if (end && (!start || end <= start)) return 'End time must be later than start time on the same day.';
  if (courts.trim() && (parseWholeNumber(courts) ?? 0) < 1) return 'Courts must be a positive whole number.';
  return null;
}

export function validateMatchInputs(input: {
  seasonId: string; session?: LeagueSession; court: string; players: (string | null)[];
  teamA: string | null; teamB: string | null; scoreA: string; scoreB: string; status: LeagueMatch['status'];
}) {
  if (!input.session || input.session.season_id !== input.seasonId) return 'Choose a session in this season.';
  if (input.court.trim()) {
    const court = parseWholeNumber(input.court);
    if (!court || (input.session.court_count != null && court > input.session.court_count))
      return `Choose a valid court${input.session.court_count ? ` between 1 and ${input.session.court_count}` : ''}.`;
  }
  if (input.teamA && input.teamA === input.teamB) return 'A team cannot play itself.';
  const players = input.players.filter(Boolean);
  if (new Set(players).size !== players.length) return 'Each player can appear only once in a match.';
  if ((input.scoreA.trim() || input.scoreB.trim() || ['verified', 'score_submitted'].includes(input.status))
    && !(input.teamA && input.teamB)
    && !((input.players[0] || input.players[1]) && (input.players[2] || input.players[3])))
    return 'Assign both sides before recording a result.';
  return validateScorePair(input.scoreA, input.scoreB, ['verified', 'score_submitted'].includes(input.status));
}

export function needsMatchAction(match: LeagueMatch) {
  // Overdue and unconfirmed games remain actionable; time alone never hides them.
  return !['verified', 'forfeit', 'canceled'].includes(match.status);
}
