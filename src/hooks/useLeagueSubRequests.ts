import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthState } from './useAuthState';
import { leagueRows, leagueProfiles } from '@/lib/leagues/data';
import type { SubRequest, SubRequestWeek } from '@/lib/leagues/subRequests';
import type { LeagueMember, LeagueSubstitute } from '@/lib/leagues/types';

/** Shared cache for the Actions page and substitute bench. Query keys include
 * the viewer and season; changing either never displays the previous roster. */
export function useLeagueSubRequests(leagueId: string, seasonId: string | null, dataVersion = 0, playerId?: string) {
  const { user } = useAuthState();
  const query = useQuery({
    queryKey: ['league-sub-requests', user?.id, leagueId, seasonId, playerId ?? 'manager'],
    enabled: !!user && !!leagueId && !!seasonId,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const filters = { league_id: leagueId, season_id: seasonId! };
      const [requests, weeks, batches, members, subs, snapshots, sitouts] = await Promise.all([
        leagueRows<SubRequest>('ladder_sub_requests', { ...filters, ...(playerId ? { player_id: playerId } : {}) }, signal),
        leagueRows<SubRequestWeek>('league_sessions', filters, signal),
        leagueRows<{ id: string; week_number: number }>('ladder_batches', filters, signal),
        playerId ? [] : leagueRows<LeagueMember>('league_members', { ...filters, status: 'active' }, signal),
        playerId ? [] : leagueRows<LeagueSubstitute>('league_substitutes', { ...filters, status: 'active' }, signal),
        playerId ? [] : leagueRows<{ id: string; week_number: number; batch_number: number; player_ids: string[] }>('ladder_snapshots', { season_id: seasonId! }, signal),
        playerId ? [] : leagueRows<{ id: string; week_number: number; player_id: string }>('ladder_week_sitouts', filters, signal),
      ]);
      const ids = [...members.map(m => m.user_id), ...subs.map(s => s.user_id)];
      const profiles = await leagueProfiles([...ids, ...requests.flatMap(r => [r.player_id, r.assigned_sub_id].filter((id): id is string => !!id))], signal);
      const order = snapshots.sort((a, b) => b.week_number - a.week_number || b.batch_number - a.batch_number)[0]?.player_ids ?? [];
      return { requests, weeks, generated: new Set(batches.map(b => b.week_number)), candidateIds: ids, order, sitouts,
        profiles: Object.fromEntries(profiles.map(p => [p.id, p])) };
    },
  });
  useEffect(() => { if (dataVersion && seasonId && user) void query.refetch(); }, [dataVersion, seasonId, user?.id, query.refetch]);
  return query;
}
