import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const creator = '10000000-0000-0000-0000-000000000001';
const stranger = '10000000-0000-0000-0000-000000000002';
const moderator = '10000000-0000-0000-0000-000000000003';
const group = '20000000-0000-0000-0000-000000000001';
const readMigration = (name: string) => readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8');
let db: PGlite;

async function asUser(id: string, sql: string, params: unknown[] = []) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id]);
  await db.exec('SET ROLE authenticated');
  try { return await db.query(sql, params); }
  finally { await db.exec('RESET ROLE'); }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE guest_players (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), display_name text NOT NULL,
      created_by uuid NOT NULL, group_id uuid);
    ALTER TABLE guest_players ENABLE ROW LEVEL SECURITY;
    GRANT SELECT, INSERT, UPDATE, DELETE ON guest_players TO authenticated;
    GRANT SELECT ON guest_players TO anon;
    CREATE TABLE group_members (group_id uuid, user_id uuid, role text);
    CREATE TABLE round_robin_players (event_id uuid, player_id uuid, guest_player_id uuid);
    CREATE TABLE round_robin_events (id uuid PRIMARY KEY, organizer_id uuid, status text);
    CREATE TABLE round_robin_schedule (event_id uuid, a1_guest_id uuid, a2_guest_id uuid, b1_guest_id uuid, b2_guest_id uuid);
    CREATE TABLE match_participants (match_id uuid, player_id uuid, guest_player_id uuid REFERENCES guest_players(id), team int);
    GRANT SELECT, INSERT ON match_participants TO authenticated;
  `);
  await db.exec(readMigration('20260910280000_optimize_guest_players_rls.sql'));
  await db.exec(readMigration('20260922120000_guest_insert_returning_visibility.sql'));
  await db.exec(readMigration('20260922120000_guest_insert_returning_visibility.sql'));
}, 30_000);

beforeEach(async () => {
  await db.exec('TRUNCATE match_participants, guest_players, group_members, round_robin_players, round_robin_events, round_robin_schedule');
});
afterAll(async () => { await db?.close(); });

describe('guest creation and reuse under production row security', () => {
  it('returns a newly created guest ID for the match wizard', async () => {
    const result = await asUser(creator,
      'INSERT INTO guest_players (display_name, created_by) VALUES ($1, $2) RETURNING id, display_name', ['Visiting player', creator]);
    expect(result.rows).toEqual([{ id: expect.any(String), display_name: 'Visiting player' }]);
  });

  it('returns a batch through a PostgREST-style CTE and attaches the IDs to a match', async () => {
    const result = await asUser(creator, `WITH pgrst_source AS (
      INSERT INTO guest_players (display_name, created_by) VALUES ('Guest A', $1), ('Guest B', $1)
      RETURNING id, display_name) SELECT * FROM pgrst_source`, [creator]);
    expect(result.rows).toHaveLength(2);
    for (const [index, guest] of result.rows.entries()) {
      await asUser(creator, 'INSERT INTO match_participants (guest_player_id, team) VALUES ($1, $2)', [guest.id, index + 1]);
    }
    expect((await db.query('SELECT * FROM match_participants')).rows).toHaveLength(2);
  });

  it('preserves creation without RETURNING used by My Guests', async () => {
    await asUser(creator, 'INSERT INTO guest_players (display_name, created_by) VALUES ($1, $2)', ['Saved guest', creator]);
    expect((await asUser(creator, 'SELECT display_name FROM guest_players')).rows).toEqual([{ display_name: 'Saved guest' }]);
  });

  it('allows a group moderator to create and read back a group guest', async () => {
    await db.query("INSERT INTO group_members VALUES ($1, $2, 'moderator')", [group, moderator]);
    expect((await asUser(moderator,
      'INSERT INTO guest_players (display_name, created_by, group_id) VALUES ($1, $2, $3) RETURNING id',
      ['Group guest', creator, group])).rows).toHaveLength(1);
  });

  it('rejects creating guests on behalf of another user without a group role', async () => {
    await expect(asUser(stranger,
      "INSERT INTO guest_players (display_name, created_by) VALUES ('Forged', $1) RETURNING id", [creator])).rejects.toThrow(/row-level security/i);
  });

  it('does not expose or allow changing another creator\'s private guest', async () => {
    await db.query("INSERT INTO guest_players (display_name, created_by) VALUES ('Private guest', $1)", [creator]);
    expect((await asUser(stranger, 'SELECT * FROM guest_players')).rows).toEqual([]);
    expect((await asUser(stranger, "UPDATE guest_players SET display_name = 'Changed' RETURNING id")).rows).toEqual([]);
  });

  it('preserves anonymous kiosk visibility without exposing private guests', async () => {
    const guest = (await db.query("INSERT INTO guest_players (display_name, created_by) VALUES ('Kiosk guest', $1) RETURNING id", [creator])).rows[0];
    await db.query("INSERT INTO guest_players (display_name, created_by) VALUES ('Private guest', $1)", [creator]);
    const event = '30000000-0000-0000-0000-000000000001';
    await db.query("INSERT INTO round_robin_events VALUES ($1, $2, 'live')", [event, creator]);
    await db.query('INSERT INTO round_robin_schedule (event_id, a1_guest_id) VALUES ($1, $2)', [event, guest.id]);
    await db.query("SELECT set_config('request.jwt.claim.sub', '', false)");
    await db.exec('SET ROLE anon');
    try {
      expect((await db.query('SELECT display_name FROM guest_players')).rows).toEqual([{ display_name: 'Kiosk guest' }]);
    } finally { await db.exec('RESET ROLE'); }
  });
});
