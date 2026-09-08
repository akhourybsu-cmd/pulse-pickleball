import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthState } from './useAuthState';
import { leagueRows } from '@/lib/leagues/data';
import { selectLeagueSeason, sortLeagueSeasons } from '@/lib/leagues/operations';
import type { LeagueSeason } from '@/lib/leagues/types';

/** One season context across every organizer tab, including shared links. */
export function useLeagueSeasons(leagueId: string, dataVersion = 0) {
  const { user } = useAuthState();
  const [params, setParams] = useSearchParams();
  const query = useQuery({
    queryKey: ['league-seasons', user?.id, leagueId],
    enabled: !!user && !!leagueId,
    queryFn: async ({ signal }) => sortLeagueSeasons(await leagueRows<LeagueSeason>('league_seasons', { league_id: leagueId }, signal)),
    staleTime: 30_000,
  });
  const { refetch } = query;
  useEffect(() => { if (dataVersion && user?.id && leagueId) void refetch(); }, [dataVersion, refetch, user?.id, leagueId]);
  const seasons = query.data ?? [];
  const season = selectLeagueSeason(seasons, params.get('season'));
  const setSeasonId = (id: string) => setParams(previous => {
    const next = new URLSearchParams(previous);
    next.set('season', id);
    return next;
  }, { replace: true });
  return { seasons, seasonId: season?.id ?? '', season, setSeasonId, loading: query.isPending, error: query.error, retry: query.refetch };
}
