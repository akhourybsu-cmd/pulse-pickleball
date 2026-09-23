// Screenshot data only. The production page, score computation and table render
// unchanged; no network connection, real accounts or production writes.
import type { LeagueMatch } from '../../../src/lib/leagues/types';
const playersById = Object.fromEntries(['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Chen'].map((display_name, index) => [`demo-${index}`, { id: `demo-${index}`, display_name }]));
const season = { id: 'demo-season', name: 'Autumn 2026', status: 'active' };
const results = [[0, 1, 11, 7], [2, 3, 11, 8], [0, 2, 11, 9], [1, 3, 11, 6], [0, 3, 11, 5], [1, 2, 8, 11]];
const allMatches: LeagueMatch[] = results.map(([a, b, team_a_score, team_b_score], index) => ({
  id: `demo-match-${index}`, season_id: season.id, player_a_id: `demo-${a}`, player_b_id: null, player_c_id: `demo-${b}`, player_d_id: null,
  team_a_id: null, team_b_id: null, team_a_score, team_b_score, status: 'verified', scheduled_time: `2026-09-${10 + index}T18:00:00Z`,
  league_id: 'demo-league', created_at: `2026-09-${10 + index}T18:00:00Z`, updated_at: `2026-09-${10 + index}T19:00:00Z`,
  session_id: null, court_number: 1, linked_match_id: null, ladder_batch_group_id: null, rating_status: 'eligible_future',
  verified_by: [`demo-${a}`, `demo-${b}`], score_submitted_by: `demo-${a}`, score_submitted_at: `2026-09-${10 + index}T19:00:00Z`,
  dispute_reason: null, forfeit_winner_team_id: null,
}));
const detail = {
  league: { id: 'demo-league', name: 'Tuesday Night Singles', description: 'Good games. Familiar faces. A new challenge every week.', location: 'Riverside Pickleball Club', league_type: 'singles', status: 'active', visibility: 'public_future', rating_eligible: true, guests_allowed: false },
  membership: { role: 'player', status: 'active', season_id: season.id }, season, seasons: [season],
  matches: allMatches.filter(match => match.player_a_id === 'demo-0' || match.player_c_id === 'demo-0'), allMatches,
  allTeams: [], teamsById: {}, playersById, teammates: [], matchSubs: [], myTeams: [],
  loading: false, currentUserId: 'demo-0', refresh: () => undefined, error: null, canManage: false,
  setSeasonId: () => undefined, sessions: [], isActiveParticipant: true, dataVersion: 1,
};
export const useLeagueDetailForPlayer = () => detail;
export const supabase = {
  auth: { getUser: async () => ({ data: { user: null } }) },
  from: () => { throw new Error('Screenshot fixtures never query a live backend.'); },
  functions: { invoke: () => { throw new Error('Screenshot actions never submit changes.'); } },
};
