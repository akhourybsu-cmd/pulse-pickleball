import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuthState } from './useAuthState';
import { useLeagueSeasons } from './useLeagueSeasons';
import { useLeagueLiveRefresh } from './useLeagueLiveRefresh';
import { leagueRows, leagueProfiles, type LeagueProfile } from '@/lib/leagues/data';
import { canManageLeague, selectSeasonMembership } from '@/lib/leagues/operations';
import { resolvePlayerName } from '@/lib/matchDisplay';
import type { League, LeagueMember, LeagueTeam, LeagueTeamMember, LeagueMatch, LeagueSession, LeagueSubstitute } from '@/lib/leagues/types';

export function useLeagueDetailForPlayer(leagueId: string | undefined) {
  const { user, loading: authLoading } = useAuthState();
  const client = useQueryClient();
  const seasonContext = useLeagueSeasons(leagueId ?? '');
  const { seasonId } = seasonContext;
  const query = useQuery({
    queryKey: ['player-league-detail', user?.id, leagueId, seasonId],
    enabled: !!user && !!leagueId && !seasonContext.loading && !seasonContext.error,
    staleTime: 15_000,
    queryFn: async ({ signal }) => {
      const [leagues, memberships, allTeams, allMatches, sessions, teamMemberships, substitutions] = await Promise.all([
        leagueRows<League>('leagues', { id: leagueId! }, signal),
        leagueRows<LeagueMember>('league_members', { league_id: leagueId!, user_id: user!.id }, signal),
        seasonId ? leagueRows<LeagueTeam>('league_teams', { league_id: leagueId!, season_id: seasonId }, signal) : [],
        seasonId ? leagueRows<LeagueMatch>('league_matches', { league_id: leagueId!, season_id: seasonId }, signal) : [],
        seasonId ? leagueRows<LeagueSession>('league_sessions', { league_id: leagueId!, season_id: seasonId }, signal) : [],
        leagueRows<LeagueTeamMember>('league_team_members', { user_id: user!.id, status: 'active' }, signal),
        seasonId ? leagueRows<LeagueSubstitute>('league_substitutes', { league_id: leagueId!, season_id: seasonId, user_id: user!.id, status: 'active' }, signal) : [],
      ]);
      const league = leagues[0] ?? null;
      const myTeamIds = new Set(allTeams.filter(t => t.captain_user_id === user!.id
        || teamMemberships.some(tm => tm.team_id === t.id)).map(t => t.id));
      const myTeams = allTeams.filter(t => myTeamIds.has(t.id));
      const roster = (await Promise.all(myTeams.map(t => leagueRows<LeagueTeamMember>('league_team_members', { team_id: t.id, status: 'active' }, signal)))).flat();
      const profiles = await leagueProfiles([
        ...roster.map(r => r.user_id), ...allMatches.flatMap(m => [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id]),
      ].filter((id): id is string => !!id), signal);
      const playersById: Record<string, LeagueProfile> = Object.fromEntries(profiles.map(p => [p.id, p]));
      const teamsById = Object.fromEntries(allTeams.map(t => [t.id, t]));
      const matches = allMatches.filter(m =>
        (m.team_a_id && myTeamIds.has(m.team_a_id)) || (m.team_b_id && myTeamIds.has(m.team_b_id))
        || [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id].includes(user!.id)
      ).sort((a, b) => (a.scheduled_time ?? '9999').localeCompare(b.scheduled_time ?? '9999') || a.id.localeCompare(b.id));
      return {
        league, membership: selectSeasonMembership(memberships, seasonId),
        isActiveParticipant: memberships.some(m => m.season_id === seasonId && m.status === 'active') || substitutions.length > 0,
        canManage: !!league && canManageLeague(league.created_by, user!.id, memberships),
        allTeams, allMatches, sessions, matches, myTeams, myTeamIds, teamsById, playersById,
        teammates: roster.map(tm => ({
          team_member_id: tm.id, team_id: tm.team_id, team_name: teamsById[tm.team_id]?.name ?? 'Team',
          user_id: tm.user_id, is_me: tm.user_id === user!.id,
          is_captain: teamsById[tm.team_id]?.captain_user_id === tm.user_id,
          role: tm.role, display_name: playersById[tm.user_id] ? resolvePlayerName(playersById[tm.user_id]) : 'Player',
          avatar_url: playersById[tm.user_id]?.avatar_url ?? null,
        })),
      };
    },
  });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['player-league-detail', user?.id, leagueId] });
    void client.invalidateQueries({ queryKey: ['league-seasons', user?.id, leagueId] });
    void client.invalidateQueries({ queryKey: ['my-leagues', user?.id] });
    void client.invalidateQueries({ queryKey: ['my-upcoming-league-matches', user?.id] });
  }, [client, user?.id, leagueId]);
  useLeagueLiveRefresh(leagueId, refresh);
  return {
    league: query.data?.league ?? null, membership: query.data?.membership ?? null,
    season: seasonContext.season, seasons: seasonContext.seasons, setSeasonId: seasonContext.setSeasonId,
    canManage: query.data?.canManage ?? false,
    isActiveParticipant: query.data?.isActiveParticipant ?? false,
    myTeams: query.data?.myTeams ?? [], myTeamIds: query.data?.myTeamIds ?? new Set<string>(),
    teammates: query.data?.teammates ?? [], matches: query.data?.matches ?? [], allMatches: query.data?.allMatches ?? [],
    allTeams: query.data?.allTeams ?? [], sessions: query.data?.sessions ?? [],
    teamsById: query.data?.teamsById ?? {}, playersById: query.data?.playersById ?? {},
    currentUserId: user?.id ?? null,
    loading: authLoading || (!!user && !seasonContext.error && (seasonContext.loading || query.isPending)),
    error: seasonContext.error ?? query.error, refreshing: query.isFetching && !query.isPending, refresh,
  };
}
