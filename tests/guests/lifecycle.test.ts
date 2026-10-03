import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRoundRobinDatabase } from '../round-robin/fixtures/database';
import { installMatchEffects } from '../round-robin/fixtures/match-effects';

const uuid = (n: number) => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = uuid(1), player = uuid(2), other = uuid(3), moderator = uuid(4), group = uuid(5);
const guest = uuid(10), duplicate = uuid(11), event = uuid(20);
const migration = 'supabase/migrations/20261003160000_round_robin_scoring_lifecycle.sql';
let db: PGlite;
const sql = (file: string) => readFileSync(`supabase/migrations/${file}`, 'utf8');
async function asUser<T = Record<string, unknown>>(id: string | null, query: string, params: unknown[] = []) {
  await db.query("SELECT set_config('test.uid', $1, false)", [id ?? '']);
  await db.exec(`SET ROLE ${id ? 'authenticated' : 'anon'}`);
  try { return (await db.query<T>(query, params)).rows; }
  finally { await db.exec('RESET ROLE'); }
}
async function rpc(id: string | null, fn: string, args: unknown[] = []) {
  const rows = await asUser<{ result: Record<string, unknown> }>(id, `SELECT ${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) AS result`, args);
  return rows[0].result;
}
async function invite(email: string | null = 'player@example.test', guestId = guest, requestId = uuid(30)) {
  const result = await rpc(owner, 'create_guest_claim_invite', [guestId, email, requestId]);
  expect(result.ok).toBe(true);
  return result;
}
async function registerGuest(target = guest, evt = event) {
  await db.query("INSERT INTO round_robin_events(id,organizer_id,status,num_courts,num_rounds) VALUES($1,$2,'live',1,2) ON CONFLICT DO NOTHING", [evt, owner]);
  await db.query('INSERT INTO round_robin_players(event_id,guest_player_id) VALUES($1,$2)', [evt, target]);
}
async function scheduledMatch(round = 1, target = guest, evt = event) {
  const id = uuid(100 + round);
  await db.query(`INSERT INTO round_robin_schedule(id,event_id,round_no,court_no,is_bye,a1_guest_id,a2_player_id,b1_player_id,b2_player_id)
    VALUES($1,$2,$3,1,false,$4,$5,$6,$7)`, [id, evt, round, target, uuid(51), uuid(52), uuid(53)]);
  return id;
}
async function score(id: string) {
  return (await asUser(owner, 'SELECT submit_rr_match_score($1,11,7) AS id', [id]))[0].id;
}

beforeAll(async () => {
  db = await createRoundRobinDatabase();
  await db.exec(`
    ALTER TABLE round_robin_events ADD location text, ADD date timestamptz DEFAULT '2026-10-03', ADD rating_type text DEFAULT 'league', ADD completed_at timestamptz;
    ALTER TABLE profiles ADD initial_self_rating numeric DEFAULT 3.5, ADD current_rating numeric DEFAULT 3.5, ADD week_start_rating numeric, ADD week_start_date date, ADD total_matches integer DEFAULT 0, ADD wins integer DEFAULT 0, ADD losses integer DEFAULT 0, ADD total_points_for integer DEFAULT 0, ADD total_points_against integer DEFAULT 0, ADD updated_at timestamptz;
    CREATE TABLE courts(id uuid PRIMARY KEY, name text);
    CREATE TABLE matches(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), status text, verification_status text, voided boolean DEFAULT false, count_for_rating boolean DEFAULT true,
      team1_score integer NOT NULL CHECK(team1_score>=0), team2_score integer NOT NULL CHECK(team2_score>=0), CHECK(abs(team1_score-team2_score)>=2),
      match_date timestamptz, created_at timestamptz DEFAULT now(), week_start date DEFAULT '2026-09-28', match_type text DEFAULT 'league',
      created_by uuid, source text, round_no integer, court_no integer, court_id uuid, other_location text, verified_by uuid[]);
    CREATE TABLE match_participants(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),match_id uuid REFERENCES matches ON DELETE CASCADE,player_id uuid REFERENCES profiles,guest_player_id uuid,team integer,rating_before numeric,rating_after numeric,rating_change numeric);
    CREATE TABLE match_approvals(id uuid DEFAULT gen_random_uuid(),match_id uuid,player_id uuid,approved boolean);
    CREATE FUNCTION get_week_start(date) RETURNS date LANGUAGE sql AS $$ SELECT date_trunc('week',$1)::date $$;
  `);
  await installMatchEffects(db);
  await db.exec(readFileSync('supabase/migrations/20260618010300_prevent_duplicate_match_insert.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260709215814_c8952a59-7763-4fcf-8f7c-0f9e7365c9cd.sql','utf8').replace('v_event.organizer_id <> v_user_id','NOT public.can_manage_round_robin(v_event.id,v_user_id)'));
  await db.exec(readFileSync('supabase/migrations/20260915100000_atomic_round_robin_round_completion.sql','utf8').replace('v_event.organizer_id IS DISTINCT FROM v_actor','NOT public.can_manage_round_robin(v_event.id,v_actor)'));
  await db.exec(readFileSync(migration,'utf8'));
  await db.exec(readFileSync(migration,'utf8')); // replay-safe migration

  await db.exec(`
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
    ALTER TABLE guest_players ALTER COLUMN id SET DEFAULT gen_random_uuid(),
      ADD display_name text NOT NULL DEFAULT 'Guest', ADD email text, ADD phone text,
      ADD skill_estimate numeric, ADD linked_at timestamptz, ADD created_at timestamptz DEFAULT now(), ADD updated_at timestamptz DEFAULT now();
    CREATE TABLE venue_customers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), competition_guest_id uuid UNIQUE REFERENCES guest_players ON DELETE SET NULL);
    ALTER TABLE round_robin_players ADD FOREIGN KEY(guest_player_id) REFERENCES guest_players ON DELETE CASCADE;
    ALTER TABLE round_robin_schedule ADD FOREIGN KEY(a1_guest_id) REFERENCES guest_players ON DELETE SET NULL;
    ALTER TABLE match_participants ADD FOREIGN KEY(guest_player_id) REFERENCES guest_players ON DELETE SET NULL;
    CREATE TABLE guest_claim_invites(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), guest_player_id uuid NOT NULL REFERENCES guest_players ON DELETE CASCADE,
      token text UNIQUE NOT NULL, invited_email text, created_by uuid NOT NULL REFERENCES auth.users,
      requires_approval boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'pending',
      accepted_at timestamptz, accepted_by_user_id uuid REFERENCES auth.users, expires_at timestamptz NOT NULL DEFAULT now()+interval '30 days',
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
    GRANT SELECT, INSERT, UPDATE, DELETE ON guest_players, guest_claim_invites TO authenticated;
    GRANT SELECT ON round_robin_events, round_robin_schedule, round_robin_players TO authenticated;
    ALTER TABLE guest_players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE guest_claim_invites ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_players ENABLE ROW LEVEL SECURITY;
    ALTER TABLE round_robin_schedule ENABLE ROW LEVEL SECURITY;
  `);
  await db.exec(sql('20260910280000_optimize_guest_players_rls.sql'));
  await db.exec(sql('20260922120000_guest_insert_returning_visibility.sql'));
  await db.exec(sql('20251020143622_2f244f74-68cf-4705-aa76-218cf3353be6.sql'));
  await db.exec(sql('20260930090000_round_robin_participant_roster_read.sql'));
  await db.exec(sql('20261003180000_guest_lifecycle.sql'));
  await db.exec(sql('20261003180000_guest_lifecycle.sql'));
}, 30_000);
beforeEach(async () => {
  await db.exec('TRUNCATE round_robin_events, round_robin_players, round_robin_schedule, round_robin_audit, rr_schedule_mutation_requests, profiles, guest_players, guest_claim_invites, auth.users, venue_customers, matches, match_participants, match_approvals, group_members CASCADE');
  await db.exec("SELECT set_config('test.mfa','true',false)");
  for (const [id, email] of [[owner, 'owner@example.test'], [player, 'player@example.test'], [other, 'other@example.test'], [moderator, 'mod@example.test']]) {
    await db.query('INSERT INTO auth.users VALUES($1,$2,now())', [id, email]);
    await db.query('INSERT INTO profiles(id) VALUES($1)', [id]);
  }
  for (const n of [51, 52, 53]) await db.query('INSERT INTO profiles(id) VALUES($1)', [uuid(n)]);
  await db.query("INSERT INTO guest_players(id,display_name,created_by) VALUES($1,'Visiting player',$3),($2,'Duplicate guest',$3)", [guest, duplicate, owner]);
});
afterAll(async () => { await db?.close(); });

describe('guest lifecycle under real SQL, row security and score effects', () => {
  it('creates a reusable guest and returns it through the organizer RLS policy', async () => {
    const rows = await asUser(owner, "INSERT INTO guest_players(display_name,created_by,gender) VALUES('New guest',$1,'female') RETURNING id,gender", [owner]);
    expect(rows).toEqual([{ id: expect.any(String), gender: 'female' }]);
    expect(await asUser(other, 'SELECT * FROM guest_players')).toEqual([]);
  });
  it('refuses direct hard deletion, account linking and forged invitations', async () => {
    await expect(asUser(owner, 'DELETE FROM guest_players WHERE id=$1', [guest])).rejects.toThrow(/permission denied/i);
    await expect(asUser(owner, 'UPDATE guest_players SET linked_user_id=$1 WHERE id=$2', [player, guest])).rejects.toThrow(/permission denied/i);
    await expect(asUser(other, "INSERT INTO guest_claim_invites(guest_player_id,token,created_by) VALUES($1,'forged',$2)", [guest, other])).rejects.toThrow(/permission denied/i);
    expect(await rpc(other, 'create_guest_claim_invite', [guest, 'other@example.test', uuid(90)])).toMatchObject({ ok: false, error: 'not_authorized' });
  });
  it('validates email and returns the same invitation on network retries', async () => {
    expect(await rpc(owner, 'create_guest_claim_invite', [guest, 'invalid', uuid(30)])).toMatchObject({ ok: false, error: 'invalid_email' });
    const first = await invite(); const retry = await invite();
    expect(retry).toEqual(first);
    expect((await db.query('SELECT * FROM guest_claim_invites')).rows).toHaveLength(1);
    expect(await rpc(owner, 'create_guest_claim_invite', [duplicate, null, uuid(30)])).toMatchObject({ ok: false, error: 'request_conflict' });
  });
  it('archives safely, revokes outstanding invitations, and restores without losing seats or scores', async () => {
    await registerGuest(); const match = await scheduledMatch(); await score(match); const sent = await invite();
    expect(await rpc(owner, 'archive_guest_player', [guest, true])).toMatchObject({ ok: true });
    expect((await db.query('SELECT guest_player_id FROM round_robin_players')).rows[0].guest_player_id).toBe(guest);
    expect((await db.query('SELECT a1_guest_id FROM round_robin_schedule')).rows[0].a1_guest_id).toBe(guest);
    expect((await db.query('SELECT * FROM match_participants WHERE guest_player_id=$1', [guest])).rows).toHaveLength(1);
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: false, error: 'invite_revoked' });
    await db.query("INSERT INTO round_robin_events(id,organizer_id) VALUES($1,$2)", [uuid(21), owner]);
    await expect(db.query('INSERT INTO round_robin_players(event_id,guest_player_id) VALUES($1,$2)', [uuid(21), guest])).rejects.toThrow(/archived/i);
    expect(await rpc(owner, 'archive_guest_player', [guest, false])).toMatchObject({ ok: true });
    await db.query('INSERT INTO round_robin_players(event_id,guest_player_id) VALUES($1,$2)', [uuid(21), guest]);
  });
  it('requires approval for a mismatched email and never replaces a pending claimant', async () => {
    const sent = await invite();
    // Legacy invitations used false; that must never bypass email verification.
    await db.exec('UPDATE guest_claim_invites SET requires_approval=false');
    expect(await rpc(other, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: true, status: 'awaiting_approval' });
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: false, error: 'claim_in_review' });
    expect(await rpc(player, 'approve_guest_claim', [sent.invite_id])).toMatchObject({ ok: false, error: 'not_authorized' });
    expect(await rpc(owner, 'approve_guest_claim', [sent.invite_id])).toMatchObject({ ok: true });
    expect(await rpc(owner, 'approve_guest_claim', [sent.invite_id])).toMatchObject({ ok: true });
    expect((await db.query('SELECT linked_user_id FROM guest_players WHERE id=$1', [guest])).rows[0].linked_user_id).toBe(other);
  });
  it('requires approval for an unverified matching email and expires pending claims', async () => {
    await db.query('UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1', [player]);
    const sent = await invite();
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ status: 'awaiting_approval' });
    await db.exec("UPDATE guest_claim_invites SET expires_at=now()-interval '1 minute'");
    expect(await rpc(owner, 'approve_guest_claim', [sent.invite_id])).toMatchObject({ ok: false, error: 'expired' });
    expect((await db.query('SELECT linked_user_id FROM guest_players WHERE id=$1', [guest])).rows[0].linked_user_id).toBeNull();
  });
  it('keeps shared-link claims reviewable by an authorized group moderator', async () => {
    await db.query('UPDATE guest_players SET group_id=$1 WHERE id=$2', [group, guest]);
    await db.query("INSERT INTO group_members(group_id,user_id,role) VALUES($1,$2,'moderator')", [group, moderator]);
    const sent = await invite(null);
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ status: 'awaiting_approval' });
    expect((await asUser(moderator, 'SELECT id FROM guest_claim_invites')).length).toBe(1);
    expect(await rpc(moderator, 'approve_guest_claim', [sent.invite_id])).toMatchObject({ ok: true });
  });
  it('links past and future scores, preserves ratings and grants the claimed player full event access', async () => {
    await registerGuest();
    await db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)', [event, uuid(51)]);
    const first = await scheduledMatch(1); await score(first);
    const sent = await invite(); const otherInvite = await invite(null, guest, uuid(31));
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: true, status: 'linked' });
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: true, status: 'linked' });
    expect(await rpc(other, 'claim_guest_profile', [otherInvite.token])).toMatchObject({ ok: false, error: 'invite_revoked' });
    expect((await db.query('SELECT total_matches,wins,current_rating FROM profiles WHERE id=$1', [player])).rows[0]).toMatchObject({ total_matches: 1, wins: 1, current_rating: '3.5' });
    expect(await asUser(player, 'SELECT * FROM my_round_robin_registrations(false)')).toEqual([{ event_id: event }]);
    expect(await asUser(player, 'SELECT id FROM round_robin_events')).toHaveLength(1);
    expect(await asUser(player, 'SELECT id FROM round_robin_players')).toHaveLength(2);
    expect(await asUser(player, 'SELECT id FROM round_robin_schedule')).toHaveLength(1);
    await score(await scheduledMatch(2));
    expect((await db.query('SELECT total_matches,current_rating FROM profiles WHERE id=$1', [player])).rows[0]).toMatchObject({ total_matches: 2, current_rating: '3.5' });
    expect((await db.query('SELECT * FROM matches WHERE count_for_rating')).rows).toHaveLength(0);
    expect((await db.query('SELECT * FROM match_participants WHERE guest_player_id=$1 AND player_id=$2', [guest, player])).rows).toHaveLength(2);
    await expect(db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)', [event, player])).rejects.toThrow(/already has/);
  });
  it('rejects claiming a second identity in the same event without changing history', async () => {
    await registerGuest(); await db.query('INSERT INTO round_robin_players(event_id,player_id) VALUES($1,$2)', [event, player]);
    const sent = await invite();
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: false, error: 'duplicate_participation' });
    expect((await db.query('SELECT status FROM guest_claim_invites')).rows[0].status).toBe('pending');
  });
  it('refuses unauthenticated and incomplete-MFA claims or management changes', async () => {
    const sent = await invite();
    await expect(rpc(null, 'approve_guest_claim', [sent.invite_id])).rejects.toThrow(/permission denied/i);
    await db.exec("SELECT set_config('test.mfa','false',false)");
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ ok: false });
    expect(await rpc(owner, 'archive_guest_player', [guest, true])).toMatchObject({ ok: false });
    expect(await rpc(owner, 'merge_guest_players', [guest, duplicate])).toMatchObject({ ok: false });
  });
  it('merges completed guest history, invitations, venue links and schedule seats atomically', async () => {
    await registerGuest(duplicate); const match = await scheduledMatch(1, duplicate); await score(match);
    await db.exec("UPDATE round_robin_events SET status='completed'");
    await db.query('INSERT INTO venue_customers(competition_guest_id) VALUES($1)', [duplicate]);
    const sent = await invite(null, duplicate);
    expect(await rpc(owner, 'merge_guest_players', [guest, duplicate])).toMatchObject({ ok: true });
    expect((await db.query('SELECT guest_player_id FROM guest_claim_invites')).rows).toEqual([{ guest_player_id: guest }]);
    expect((await db.query('SELECT competition_guest_id FROM venue_customers')).rows).toEqual([{ competition_guest_id: guest }]);
    expect((await db.query('SELECT a1_guest_id FROM round_robin_schedule')).rows).toEqual([{ a1_guest_id: guest }]);
    expect((await db.query('SELECT * FROM match_participants WHERE guest_player_id=$1', [guest])).rows).toHaveLength(1);
    expect(await rpc(player, 'claim_guest_profile', [sent.token])).toMatchObject({ status: 'awaiting_approval' });
  });
  it('does not merge live seats, overlapping registrations or separate venue customers', async () => {
    await registerGuest(guest); await registerGuest(duplicate);
    expect(await rpc(owner, 'merge_guest_players', [guest, duplicate])).toMatchObject({ ok: false, error: 'active_event_merge' });
    await db.exec("UPDATE round_robin_events SET status='completed'");
    expect(await rpc(owner, 'merge_guest_players', [guest, duplicate])).toMatchObject({ ok: false, error: 'duplicate_participation' });
    await db.exec('DELETE FROM round_robin_players');
    await db.query('INSERT INTO venue_customers(competition_guest_id) VALUES($1),($2)', [guest, duplicate]);
    expect(await rpc(owner, 'merge_guest_players', [guest, duplicate])).toMatchObject({ ok: false, error: 'venue_customer_conflict' });
    expect((await db.query('SELECT * FROM guest_players')).rows).toHaveLength(2);
  });
});
