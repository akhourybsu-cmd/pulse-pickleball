import type { HistoryMatch } from '@/lib/matchHistory';

export function matchHistoryPath(matchId: string) {
  return `/player/matches?match=${encodeURIComponent(matchId)}`;
}

/** Only resolve within the history already authorized for this viewer. */
export function linkedHistoryMatch(id: string | null, matches: HistoryMatch[], pending: HistoryMatch[]) {
  if (!id) return null;
  const completed = matches.find(match => match.match_id === id);
  if (completed) return { match: completed, pending: false };
  const awaiting = pending.find(match => match.match_id === id);
  return awaiting ? { match: awaiting, pending: true } : null;
}
