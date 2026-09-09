import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthState } from './useAuthState';
import { leagueProfiles, leagueRows, leagueRowsByIds, type LeagueProfile } from '@/lib/leagues/data';
import type { LeagueMatch, LeagueMember, LeagueSession, LeagueTeam, LeagueTeamMember, LeagueSubstitute, LeagueMatchSubstitution } from '@/lib/leagues/types';

type Section = 'matches' | 'members' | 'sessions' | 'teams' | 'rosters' | 'subs';
interface WorkspaceData {
  matches: LeagueMatch[]; members: LeagueMember[]; sessions: LeagueSession[]; teams: LeagueTeam[];
  subs: LeagueSubstitute[];
  substitutions: LeagueMatchSubstitution[];
  batchByGroup: Record<string, { batch_id: string; week_number: number; batch_number: number }>;
  profilesById: Record<string, LeagueProfile>; rosterCounts: Record<string, number>;
}
/** Season-keyed requests cannot overwrite a newly selected season on arrival. */
export function useLeagueWorkspace(leagueId: string, seasonId: string, dataVersion: number, sections: Section[]) {
  const { user } = useAuthState();
  const query = useQuery<WorkspaceData>({
    queryKey: ['league-workspace', user?.id, leagueId, seasonId, sections.join(',')],
    enabled: !!user && !!seasonId,
    staleTime: 30_000,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === user?.id && previousQuery?.queryKey[2] === leagueId && previousQuery?.queryKey[3] === seasonId ? previous : undefined,
    queryFn: async ({ signal }) => {
      const scope = { league_id: leagueId, season_id: seasonId };
      const [matches, members, sessions, teams, subs, substitutions] = await Promise.all([
        sections.includes('matches') ? leagueRows<LeagueMatch>('league_matches', scope, signal) : [],
        sections.includes('members') ? leagueRows<LeagueMember>('league_members', scope, signal) : [],
        sections.includes('sessions') ? leagueRows<LeagueSession>('league_sessions', scope, signal) : [],
        sections.includes('teams') ? leagueRows<LeagueTeam>('league_teams', scope, signal) : [],
        sections.includes('subs') ? leagueRows<LeagueSubstitute>('league_substitutes', scope, signal) : [],
        sections.includes('matches') ? leagueRows<LeagueMatchSubstitution>('league_match_substitutions', scope, signal) : [],
      ]);
      const groups = sections.includes('subs') ? await leagueRowsByIds<{ id: string; batch_id: string }>(
        'ladder_batch_groups', matches.map(m => m.ladder_batch_group_id).filter((id): id is string => !!id), signal,
      ) : [];
      const batches = await leagueRowsByIds<{ id: string; week_number: number; batch_number: number }>(
        'ladder_batches', groups.map(g => g.batch_id), signal,
      );
      const batchMap = new Map(batches.map(b => [b.id, b]));
      const batchByGroup: WorkspaceData['batchByGroup'] = {};
      groups.forEach(g => { const b = batchMap.get(g.batch_id); if (b) batchByGroup[g.id] = { batch_id: b.id, week_number: b.week_number, batch_number: b.batch_number }; });
      const rosters = sections.includes('rosters') ? (await Promise.all(teams.map(t =>
        leagueRows<LeagueTeamMember>('league_team_members', { team_id: t.id, status: 'active' }, signal)))).flat() : [];
      const profiles = await leagueProfiles([
        ...members.map(m => m.user_id), ...rosters.map(r => r.user_id), ...subs.map(s => s.user_id),
        ...matches.flatMap(m => [m.player_a_id, m.player_b_id, m.player_c_id, m.player_d_id]),
        ...substitutions.flatMap(s => [s.in_player_id, s.out_player_id]),
      ].filter((id): id is string => !!id), signal);
      return {
        matches, members, sessions: sessions.sort((a,b) => (a.scheduled_date ?? '9999').localeCompare(b.scheduled_date ?? '9999')), teams, subs, substitutions, batchByGroup,
        profilesById: Object.fromEntries(profiles.map(p => [p.id, p])),
        rosterCounts: rosters.reduce<Record<string, number>>((counts, r) => { counts[r.team_id] = (counts[r.team_id] ?? 0) + 1; return counts; }, {}),
      };
    },
  });
  const { refetch } = query;
  useEffect(() => { if (dataVersion && user?.id && seasonId) void refetch(); }, [dataVersion, refetch, user?.id, seasonId]);
  return {
    matches: query.data?.matches ?? [], members: query.data?.members ?? [], sessions: query.data?.sessions ?? [], teams: query.data?.teams ?? [],
    profilesById: query.data?.profilesById ?? {}, rosterCounts: query.data?.rosterCounts ?? {},
    subs: query.data?.subs ?? [], batchByGroup: query.data?.batchByGroup ?? {},
    substitutions: query.data?.substitutions ?? [],
    loading: !!seasonId && query.isPending, error: query.error, reload: query.refetch,
  };
}
