import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthState } from './useAuthState';
import { leagueRows, leagueProfiles } from '@/lib/leagues/data';
import type { SubRequest } from '@/lib/leagues/subRequests';
import type { LeagueMatch, LeagueMember, LeagueSeason } from '@/lib/leagues/types';

/** All seasons, not just the selected one: an older pending item must not
 * disappear because the organizer is looking at a newer season. */
export function useLeagueActions(leagueId: string | undefined, enabled: boolean, dataVersion: number) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ['league-actions', user?.id, leagueId], enabled: enabled && !!user && !!leagueId,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const filters = { league_id: leagueId! };
      const [requests, disputes, scores, members, seasons] = await Promise.all([
        leagueRows<SubRequest>('ladder_sub_requests', { ...filters, status: 'pending' }, signal),
        leagueRows<LeagueMatch>('league_matches', { ...filters, status: 'disputed' }, signal),
        leagueRows<LeagueMatch>('league_matches', { ...filters, status: 'score_submitted' }, signal),
        leagueRows<LeagueMember>('league_members', { ...filters, status: 'pending' }, signal),
        leagueRows<LeagueSeason>('league_seasons', filters, signal),
      ]);
      const profiles = await leagueProfiles(requests.map(r => r.player_id), signal);
      const seasonMembers = members.filter(m => m.season_id && seasons.some(s => s.id === m.season_id));
      return { requests: requests.sort((a, b) => a.created_at.localeCompare(b.created_at)), disputes, scores, members: seasonMembers, seasons,
        profiles: Object.fromEntries(profiles.map(p => [p.id, p])), total: requests.length + disputes.length + scores.length + seasonMembers.length };
    },
  });
  useEffect(() => { if (enabled && dataVersion && user) void query.refetch(); }, [enabled, dataVersion, user?.id, query.refetch]);
  return query;
}
