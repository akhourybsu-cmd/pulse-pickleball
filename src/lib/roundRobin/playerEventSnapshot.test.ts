import { describe, expect, it } from 'vitest';
import { buildPlayerEventSnapshot, type HydratedEventMatch, type HydratedEventPlayer } from './playerEventSnapshot';

const roster: HydratedEventPlayer[] = ['a', 'b', 'c'].map(id => ({
  id: `roster-${id}`, player_id: id, guest_player_id: null, active: id !== 'b',
  profiles: { display_name: id.toUpperCase(), avatar_url: `${id}.png`, current_rating: 3.75 },
  registration_status: 'confirmed',
}));
roster.push({ id: 'roster-g', player_id: null, guest_player_id: 'g', guest_name: 'Saved guest',
  active: true, profiles: null, registration_status: 'waitlisted', guest_players: { display_name: 'Grace', linked_user_id: 'user-g' } });
const match: HydratedEventMatch = {
  id: 'm1', round_no: 1, court_no: 1, is_bye: false,
  a1_player_id: 'a', a2_player_id: 'b', b1_player_id: 'c', b2_player_id: null,
  a1_guest_id: null, a2_guest_id: null, b1_guest_id: null, b2_guest_id: 'g',
  team1_score: 11, team2_score: 0,
};

describe('shared player event snapshot', () => {
  it('keeps the full roster, ratings, avatars, waitlist and linked guest identity', () => {
    const result = buildPlayerEventSnapshot(roster, [match]);
    expect(result.players).toHaveLength(4);
    expect(result.byId.get('a')?.profiles).toMatchObject({ avatar_url: 'a.png', current_rating: 3.75 });
    expect(result.byId.get('g')).toMatchObject({ is_guest: true, guest_display_name: 'Grace', guest_linked_user_id: 'user-g', registration_status: 'waitlisted' });
    expect(result.standings.find(row => row.playerId === 'g')?.playerName).toBe('Grace');
  });
  it('counts shutouts and preserves removed players in historical standings', () => {
    const result = buildPlayerEventSnapshot(roster, [match]);
    expect(result.schedule[0].completed).toBe(true);
    expect(result.standings.find(row => row.playerId === 'a')).toMatchObject({ wins: 1, gamesPlayed: 1 });
    expect(result.standings.at(-1)).toMatchObject({ playerId: 'b', isRemoved: true, wins: 1 });
    expect(result.byId.get('b')?.registration_status).toBe('');
  });
  it.each([{ abandoned: true }, { is_bye: true }, { voided_at: 'yesterday' }, { superseded_by_schedule_id: 'new' }])('excludes obsolete results: %o', flags => {
    const result = buildPlayerEventSnapshot(roster, [{ ...match, ...flags }]);
    expect(result.schedule[0].completed).toBe(false);
    expect(result.standings.every(row => row.gamesPlayed === 0)).toBe(true);
  });
  it('resolves schedule-only and unavailable guest profiles without dropping names', () => {
    const result = buildPlayerEventSnapshot([roster[0]], [{ ...match,
      a2_profile: { display_name: 'Former player' }, b2_guest: { display_name: 'Grace' },
    }]);
    expect(result.byId.get('b')?.profiles?.display_name).toBe('Former player');
    expect(result.byId.get('g')).toMatchObject({ active: false, is_guest: true, guest_display_name: 'Grace' });
    expect(result.standings.find(row => row.playerId === 'g')?.playerName).toBe('Grace (G)');
    const fallback = buildPlayerEventSnapshot([{ ...roster[3], guest_players: null }], []);
    expect(fallback.players[0].guest_display_name).toBe('Saved guest');
  });
  it('updates scores from the next snapshot without mutating the saved input or truncating large schedules', () => {
    const rows = Array.from({ length: 1700 }, (_, i) => ({ ...match, id: `m${i}`, round_no: i + 1 }));
    const before = buildPlayerEventSnapshot(roster, rows);
    const after = buildPlayerEventSnapshot(roster, rows.map(row => row.id === 'm0' ? { ...row, team1_score: 0, team2_score: 11 } : row));
    expect(after.schedule).toHaveLength(1700);
    expect(Object.keys(after.groupedSchedule)).toHaveLength(1700);
    expect(before.standings.find(row => row.playerId === 'a')?.wins).toBe(1700);
    expect(after.standings.find(row => row.playerId === 'a')?.wins).toBe(1699);
    expect(rows[0].team1_score).toBe(11);
  });
});
